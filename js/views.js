// Pantallas principales: Resumen, Movimientos y Deudas.

import { h, fill, money, num, signed, pct, cap, monthName, monthLabel, curYM, addMonths, todayStr, daysInMonth, dayLabel, norm, debounce } from './util.js';
import {
  state,
  monthTotals,
  monthMovements,
  byCategory,
  trend,
  expenseUpTo,
  split502030,
  getCat,
  categoriesOf,
  debtInfo,
  debtTotals,
  byNewest,
  backupStatus,
  storageVolatile,
} from './store.js';
import { icon, row, emptyState, openSheet, linkBtn, segmented, iconBtn } from './ui.js';
import { donut, bars } from './charts.js';
import { openMovementSheet, openDebtSheet, openDebtDetail, openPaymentSheet, openGlossarySheet } from './forms.js';
import { V, go, setMonth, render } from './nav.js';
import { exportBackup } from './backup.js';

// ---------- Piezas comunes ----------
export const navBar = (title, right = []) => h('div', { class: 'nav' }, h('div', { class: 'nav-inner' }, h('div', { class: 'nav-title' }, title), h('div', { class: 'nav-right' }, right)));

const section = (title, right) => h('div', { class: 'sect' }, h('h2', { class: 'sect-title' }, title), right || null);
const seeAll = (label, onClick) => h('button', { type: 'button', class: 'sect-link', onClick }, label);

function monthNav({ all = false } = {}) {
  const now = curYM();
  return h(
    'div',
    { class: 'monthnav' },
    h('button', { type: 'button', class: 'mn-btn', 'aria-label': 'Mes anterior', disabled: all, onClick: () => setMonth(addMonths(V.month, -1)) }, icon('left')),
    h('div', { class: 'mn-label', 'aria-live': 'polite' }, all ? 'Todo el historial' : cap(monthLabel(V.month))),
    h('button', { type: 'button', class: 'mn-btn', 'aria-label': 'Mes siguiente', disabled: all || V.month >= now, onClick: () => setMonth(addMonths(V.month, 1)) }, icon('right'))
  );
}

export function movRow(m) {
  const c = getCat(m.categoryId);
  return row({
    emoji: c.emoji,
    color: c.color,
    title: m.note || c.name,
    sub: m.note ? c.name : null,
    right: signed(m.amount, m.type),
    rightClass: m.type === 'ingreso' ? 'inc' : '',
    onClick: () => openMovementSheet(m),
  });
}

const bigMoney = (n) => h('span', null, n < 0 ? '−' : '', h('span', { class: 'cur' }, '$'), num(n));

// =====================================================================
// Resumen
// =====================================================================
function heroBlock(ym, tot) {
  const isNow = ym === curYM();
  const name = monthName(ym);
  const neg = tot.balance < 0;
  const label = neg ? `Gastaste de más en ${name}` : isNow ? `Te queda en ${name}` : `Te quedó en ${name}`;

  let spent = 0;
  let left = 0;
  if (tot.income > 0) {
    spent = Math.min(100, (tot.expense / tot.income) * 100);
    left = 100 - spent;
  } else if (tot.expense > 0) spent = 100;

  const pocket = h(
    'div',
    { class: 'pocket', role: 'img', 'aria-label': tot.income > 0 ? `Has gastado el ${pct(tot.expense, tot.income)} % de tus ingresos` : 'Sin ingresos este mes' },
    spent > 0 ? h('i', { class: 'spent', style: { flex: `${spent} 1 0%` } }) : null,
    left > 0 ? h('i', { class: 'left', style: { flex: `${left} 1 0%` } }) : null
  );

  return h(
    'section',
    { class: 'hero' },
    h('div', { class: 'hero-label' }, label),
    h('div', { class: 'hero-amt' + (neg ? ' neg' : '') }, bigMoney(tot.balance)),
    pocket,
    h(
      'div',
      { class: 'hero-split' },
      h('div', null, h('span', { class: 'k' }, h('i', { class: 'dot inc' }), 'Ingresos'), h('b', null, money(tot.income))),
      h('div', { style: { textAlign: 'right' } }, h('span', { class: 'k', style: { justifyContent: 'flex-end' } }, h('i', { class: 'dot exp' }), 'Gastos'), h('b', null, money(tot.expense)))
    )
  );
}

function insightsBlock(ym, tot) {
  const isNow = ym === curYM();
  const out = [];
  const day = +todayStr().slice(8, 10);

  if (tot.income > 0 && tot.expense > 0) {
    if (tot.expense > tot.income) out.push(h('div', { class: 'insight' }, isNow ? 'Llevas gastados ' : 'Gastaste ', h('b', null, money(tot.expense - tot.income)), isNow ? ' más de lo que ingresó este mes.' : ' más de lo que ingresó ese mes.'));
    else out.push(h('div', { class: 'insight' }, isNow ? 'Llevas gastado el ' : 'Gastaste el ', h('b', null, pct(tot.expense, tot.income) + ' %'), isNow ? ' de tus ingresos del mes.' : ' de tus ingresos de ese mes.'));
  }

  if (isNow && tot.balance > 0) {
    const daysLeft = daysInMonth(ym) - day + 1;
    if (daysLeft <= 1) out.push(h('div', { class: 'insight' }, 'Hoy es el último día del mes y te quedan ', h('b', null, money(tot.balance)), '.'));
    else {
      const perDay = tot.balance / daysLeft;
      const shown = perDay >= 1000 ? Math.floor(perDay / 1000) * 1000 : Math.floor(perDay);
      out.push(h('div', { class: 'insight' }, `Faltan ${daysLeft} días para cerrar el mes. Si repartes lo que te queda, puedes gastar unos `, h('b', null, money(shown)), ' al día.'));
    }
  }

  const prev = addMonths(ym, -1);
  const prevExpense = isNow ? expenseUpTo(prev, day) : monthTotals(prev).expense;
  if (prevExpense > 0 && tot.expense > 0) {
    const d = Math.round(((tot.expense - prevExpense) / prevExpense) * 100);
    if (Math.abs(d) >= 3) {
      out.push(
        isNow
          ? h('div', { class: 'insight' }, 'A esta misma fecha vas ', h('b', null, `${Math.abs(d)} % por ${d > 0 ? 'encima' : 'debajo'}`), ` de ${monthName(prev)}.`)
          : h('div', { class: 'insight' }, 'Gastaste ', h('b', null, `${Math.abs(d)} % ${d > 0 ? 'más' : 'menos'}`), ` que en ${monthName(prev)}.`)
      );
    }
  }
  return out.length ? h('div', { class: 'group insights' }, out.slice(0, 3)) : null;
}

function spendingBlock(ym) {
  const cats = byCategory(ym, 'gasto');
  if (!cats.length) return null;
  let items = cats.map((c) => ({ label: c.cat.name, value: c.value, color: c.cat.color, cat: c.cat, share: c.share }));
  if (items.length > 6) {
    const rest = items.slice(5);
    items = items.slice(0, 5);
    items.push({ label: 'Otras categorías', value: rest.reduce((a, i) => a + i.value, 0), color: '#9A9AA0', share: rest.reduce((a, i) => a + i.share, 0), cat: null });
  }
  const chart = donut({ items, totalLabel: 'Gastos' });
  const rows = items.map((it) =>
    h(
      'button',
      {
        type: 'button',
        class: 'row flush',
        onClick: () => go('movs', { history: { categoryId: it.cat ? it.cat.id : null, type: 'gasto', all: false, q: '' } }),
      },
      h('span', { class: 'swatch', style: { background: it.color }, 'aria-hidden': 'true' }),
      h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, it.cat ? `${it.cat.emoji} ${it.label}` : it.label)),
      h('span', { class: 'share' }, Math.round(it.share * 100) + ' %'),
      h('div', { class: 'row-right' }, money(it.value))
    )
  );
  return h('div', null, section('En qué se fue', seeAll('Ver todo', () => go('movs', { history: { type: 'gasto', categoryId: null, all: false, q: '' } }))), h('div', { class: 'group donut-card' }, chart.el, rows));
}

function ruleBlock(ym) {
  const sp = split502030(ym);
  if (sp.income <= 0) return null;
  const P = (v) => Math.round((v / sp.income) * 100);
  const defs = [
    { name: 'Necesidades', val: sp.need, target: 50, max: true, goal: 'hasta 50 %' },
    { name: 'Gustos', val: sp.want, target: 30, max: true, goal: 'hasta 30 %' },
    { name: 'Ahorro', val: sp.saved, target: 20, max: false, goal: 'mínimo 20 %' },
  ];
  const rows = defs.map((d) => {
    const p = P(d.val);
    const cls = d.max ? (p > d.target ? 'over' : 'ok') : p < 0 ? 'over' : p < d.target ? 'low' : 'ok';
    const verdict = d.max ? (p > d.target ? 'Te pasaste de la meta' : 'Dentro de la meta') : p < 0 ? 'Gastaste más de lo que ingresó' : p < d.target ? 'Por debajo de la meta' : 'Cumples la meta';
    return h(
      'div',
      { class: 'meter-row' },
      h('div', { class: 'meter-top' }, h('span', { class: 'n' }, d.name), h('span', { class: 'p' }, `${p} % de tus ingresos`)),
      h('div', { class: 'meter', role: 'img', 'aria-label': `${d.name}: ${p} %, meta ${d.goal}` }, h('div', { class: 'meter-fill ' + cls, style: { width: Math.max(0, Math.min(100, p)) + '%' } }), h('div', { class: 'meter-mark', style: { left: `calc(${d.target}% - 1px)` } })),
      h('div', { class: 'meter-sub' }, `${money(d.val)} · ${verdict} (${d.goal})`)
    );
  });
  return h(
    'div',
    null,
    section('Regla 50/30/20', seeAll('¿Qué es?', openGlossarySheet)),
    h('div', { class: 'group' }, rows),
    h('p', { class: 'note' }, 'Una guía para repartir tus ingresos: hasta la mitad en necesidades, hasta 30 % en gustos y al menos 20 % para ahorrar o pagar deudas.')
  );
}

function trendBlock(ym) {
  const data = trend(ym, 6);
  if (!data.some((d) => d.income || d.expense)) return null;
  const chart = bars(data, { selected: ym, onSelect: (m) => setMonth(m) });
  return h(
    'div',
    null,
    section('Últimos 6 meses'),
    h(
      'div',
      { class: 'group bars-card' },
      chart,
      h('div', { class: 'legend-inline' }, h('span', null, h('i', { class: 'dot inc' }), 'Ingresos'), h('span', null, h('i', { class: 'dot exp' }), 'Gastos'))
    ),
    h('p', { class: 'note' }, 'Toca un mes para ver su resumen.')
  );
}

function debtsMini() {
  const dt = debtTotals();
  if (!dt.active) return null;
  return h(
    'div',
    null,
    section('Deudas'),
    h('div', { class: 'group' }, row({ ico: 'card', title: `Debes ${money(dt.remaining)}`, sub: dt.monthly ? `Cuotas del mes: ${money(dt.monthly)}` : `${dt.active} ${dt.active === 1 ? 'deuda activa' : 'deudas activas'}`, chevron: true, onClick: () => go('deudas') }))
  );
}

function bannerBlocks() {
  const out = [];
  if (storageVolatile()) {
    out.push(h('div', { class: 'banner' }, h('p', null, h('b', null, 'Tus datos no se están guardando. '), 'Este navegador bloquea el almacenamiento. Abre Bolsillo desde el ícono de tu pantalla de inicio.')));
  }
  const bk = backupStatus();
  if (bk.due) {
    out.push(
      h(
        'div',
        { class: 'banner' },
        h('p', null, h('b', null, bk.last ? `Hace ${bk.days} días que no haces un respaldo. ` : 'Aún no has hecho un respaldo. '), 'Guárdalo en Archivos para no perder tus datos.'),
        h('button', { type: 'button', class: 'btn sm', onClick: exportBackup }, 'Respaldar')
      )
    );
  }
  return out;
}

export function dashboardView() {
  const ym = V.month;
  const tot = monthTotals(ym);
  const hasAny = state.movements.length > 0;
  const hasMonth = tot.income > 0 || tot.expense > 0;
  const page = h('div', { class: 'page' }, h('h1', { class: 'h-large' }, 'Resumen'), monthNav(), h('div', { style: { height: '14px' } }), bannerBlocks(), heroBlock(ym, tot));

  if (!hasMonth) {
    page.append(
      hasAny
        ? emptyState({ emoji: '🗓️', title: `Sin movimientos en ${monthName(ym)}`, text: 'Cuando anotes ingresos o gastos de este mes, aquí vas a ver a dónde se fue tu plata.', actionLabel: 'Agregar movimiento', onAction: () => openMovementSheet(null, {}) })
        : h(
            'div',
            { class: 'empty' },
            h('div', { class: 'em', 'aria-hidden': 'true' }, '👋'),
            h('h3', null, 'Empecemos por tu plata'),
            h('p', null, 'Anota primero lo que te entra este mes y después tus gastos. Con eso la app te dice cuánto te queda.'),
            h('div', { class: 'stack', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' } }, h('button', { type: 'button', class: 'btn', onClick: () => openMovementSheet(null, { type: 'ingreso' }) }, 'Agregar un ingreso'), h('button', { type: 'button', class: 'btn secondary', style: { width: 'auto', padding: '0 26px' }, onClick: () => openMovementSheet(null, { type: 'gasto' }) }, 'Agregar un gasto'))
          )
    );
    const dm = debtsMini();
    if (dm) page.append(dm);
    return page;
  }

  const ins = insightsBlock(ym, tot);
  if (ins) page.append(h('div', { style: { height: '22px' } }), ins);
  for (const b of [spendingBlock(ym), ruleBlock(ym), debtsMini(), trendBlock(ym)]) if (b) page.append(b);

  const recent = monthMovements(ym).slice(0, 5);
  if (recent.length) {
    page.append(section('Últimos movimientos', seeAll('Ver todos', () => go('movs', { history: { type: 'todos', categoryId: null, all: false, q: '' } }))), h('div', { class: 'group' }, recent.map(movRow)));
  }
  return page;
}

// =====================================================================
// Movimientos
// =====================================================================
function openCategoryFilter() {
  const types = V.history.type === 'todos' ? ['gasto', 'ingreso'] : [V.history.type];
  const pick = (id) => {
    V.history.categoryId = id;
    V.history.limit = 150;
    ctl.close();
    render();
  };
  const check = () => h('span', { class: 'chev', style: { color: 'var(--ink)' } }, icon('check'));
  const body = h(
    'div',
    null,
    h('div', { class: 'group' }, row({ ico: 'tag', title: 'Todas las categorías', right: V.history.categoryId ? null : check(), onClick: () => pick(null) })),
    types.map((t) =>
      h(
        'div',
        null,
        types.length > 1 ? h('div', { class: 'sect', style: { marginTop: '22px' } }, h('h2', { class: 'sect-title', style: { fontSize: '17px' } }, t === 'gasto' ? 'Gastos' : 'Ingresos')) : h('div', { style: { height: '14px' } }),
        h('div', { class: 'group' }, categoriesOf(t).map((c) => row({ emoji: c.emoji, color: c.color, title: c.name, right: V.history.categoryId === c.id ? check() : null, onClick: () => pick(c.id) })))
      )
    )
  );
  const ctl = openSheet({ title: 'Categoría', right: linkBtn('Cerrar', () => ctl.close()), body });
}

function groupByDate(list) {
  const out = [];
  let cur = null;
  for (const m of list) {
    if (!cur || cur.date !== m.date) {
      cur = { date: m.date, items: [] };
      out.push(cur);
    }
    cur.items.push(m);
  }
  return out;
}

function filteredMovements() {
  const f = V.history;
  let list = f.all ? [...state.movements] : state.movements.filter((m) => m.date.slice(0, 7) === V.month);
  if (f.type !== 'todos') list = list.filter((m) => m.type === f.type);
  if (f.categoryId) list = list.filter((m) => m.categoryId === f.categoryId);
  const q = norm(f.q).trim();
  if (q) {
    const digits = q.replace(/\D/g, '');
    list = list.filter((m) => norm(m.note).includes(q) || norm(getCat(m.categoryId).name).includes(q) || (digits && String(m.amount).includes(digits)));
  }
  return list.sort(byNewest);
}

export function historyView() {
  const f = V.history;
  const listEl = h('div');

  const renderList = () => {
    const list = filteredMovements();
    if (!list.length) {
      fill(listEl,
        state.movements.length === 0
          ? emptyState({ emoji: '🧾', title: 'Aún no hay movimientos', text: 'Cada gasto o ingreso que anotes va a aparecer aquí.', actionLabel: 'Agregar movimiento', onAction: () => openMovementSheet(null, {}) })
          : emptyState({ emoji: '🔎', title: 'Sin resultados', text: f.all ? 'No hay movimientos con estos filtros.' : 'No hay movimientos con estos filtros en este mes. Prueba con "Todo el historial".' })
      );
      return;
    }
    const shown = list.slice(0, f.limit);
    const groups = groupByDate(shown).map((g) => {
      const exp = g.items.filter((m) => m.type === 'gasto').reduce((a, m) => a + m.amount, 0);
      const inc = g.items.filter((m) => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0);
      return h('div', null, h('div', { class: 'dayhead' }, h('span', null, cap(dayLabel(g.date))), h('span', null, exp ? `−${money(exp)}` : `+${money(inc)}`)), h('div', { class: 'group' }, g.items.map(movRow)));
    });
    const inc = list.filter((m) => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0);
    const exp = list.filter((m) => m.type === 'gasto').reduce((a, m) => a + m.amount, 0);
    fill(listEl,
      h('div', null, groups),
      list.length > shown.length
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn secondary sm more',
              onClick: () => {
                f.limit += 150;
                renderList();
              },
            },
            `Mostrar más (${list.length - shown.length})`
          )
        : null,
      h('div', { class: 'summary-line' }, h('div', null, `${list.length} ${list.length === 1 ? 'movimiento' : 'movimientos'}`), h('div', { class: 'sum-flex' }, inc ? h('span', null, `Ingresos ${money(inc)}`) : null, exp ? h('span', null, `Gastos ${money(exp)}`) : null))
    );
  };

  const input = h('input', { type: 'search', placeholder: 'Buscar nota, categoría o monto', value: f.q, 'aria-label': 'Buscar', enterkeyhint: 'search', autocomplete: 'off' });
  const clear = h(
    'button',
    {
      type: 'button',
      class: 'clear',
      'aria-label': 'Borrar búsqueda',
      hidden: !f.q,
      onClick: () => {
        input.value = '';
        f.q = '';
        clear.hidden = true;
        renderList();
        input.focus();
      },
    },
    icon('xfill')
  );
  input.addEventListener(
    'input',
    debounce(() => {
      f.q = input.value;
      f.limit = 150;
      clear.hidden = !f.q;
      renderList();
    }, 140)
  );
  input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());

  const seg = segmented(
    [
      { value: 'todos', label: 'Todos' },
      { value: 'gasto', label: 'Gastos' },
      { value: 'ingreso', label: 'Ingresos' },
    ],
    f.type,
    (v) => {
      f.type = v;
      const c = f.categoryId && state.categories.find((x) => x.id === f.categoryId);
      if (c && v !== 'todos' && c.type !== v) f.categoryId = null;
      f.limit = 150;
      render();
    }
  );

  const cat = f.categoryId ? getCat(f.categoryId) : null;
  const chips = h(
    'div',
    { class: 'filters' },
    h(
      'button',
      {
        type: 'button',
        class: 'chip' + (cat ? ' on' : ''),
        onClick: openCategoryFilter,
      },
      cat ? `${cat.emoji} ${cat.name}` : 'Categoría',
      icon('down')
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'chip' + (f.all ? ' on' : ''),
        'aria-pressed': f.all ? 'true' : 'false',
        onClick: () => {
          f.all = !f.all;
          f.limit = 150;
          render();
        },
      },
      'Todo el historial'
    )
  );
  const page = h('div', { class: 'page' }, h('h1', { class: 'h-large' }, 'Movimientos'), h('div', { class: 'search' }, icon('search'), input, clear), seg, h('div', { style: { height: '12px' } }), monthNav({ all: f.all }), chips, h('div', { style: { height: '10px' } }), listEl);
  renderList();
  return page;
}

// =====================================================================
// Deudas
// =====================================================================
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function debtStatusTag(info) {
  if (info.done) return h('span', { class: 'tag ok' }, icon('check'), 'Saldada');
  if (info.cuotaPaid) return h('span', { class: 'tag ok' }, icon('check'), 'Cuota de este mes pagada');
  if (info.status === 'overdue') return h('span', { class: 'tag overdue' }, icon('alert'), `Atrasada ${plural(-info.daysLeft, 'día', 'días')}`);
  if (info.status === 'soon') return h('span', { class: 'tag soon' }, info.daysLeft === 0 ? 'Vence hoy' : `Vence en ${plural(info.daysLeft, 'día', 'días')}`);
  if (info.due) return h('span', { class: 'tag' }, `Próximo pago: ${dayLabel(info.due)}`);
  return null;
}

function debtCard(d) {
  const info = debtInfo(d);
  const p = Math.round(info.pct * 100);
  const subBits = [];
  if (d.monthly) subBits.push(`Cuota ${money(d.monthly)}`);
  if (d.dueDay) subBits.push(`día ${d.dueDay}`);
  return h(
    'div',
    { class: 'debt-card' },
    h(
      'button',
      { type: 'button', class: 'debt-open', onClick: () => openDebtDetail(d.id), 'aria-label': `Ver detalle de ${d.name}` },
      h('div', { class: 'debt-top' }, h('div', { style: { minWidth: 0 } }, h('div', { class: 'debt-name' }, d.name), h('div', { class: 'debt-left' }, subBits.length ? subBits.join(' · ') : 'Sin cuota definida')), h('div', null, h('div', { class: 'debt-amt' }, money(info.remaining)), h('div', { class: 'debt-left', style: { textAlign: 'right' } }, info.done ? 'pagada' : 'falta'))),
      h('div', { class: 'progress', role: 'img', 'aria-label': `${p} % pagado` }, h('i', { style: { width: p + '%' } })),
      h('div', { class: 'debt-meta' }, h('span', null, `${p} % pagado`), info.cuotasLeft ? h('span', null, `≈ ${plural(info.cuotasLeft, 'cuota', 'cuotas')} por pagar`) : null)
    ),
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', minHeight: '38px' } }, debtStatusTag(info) || h('span'), info.done ? null : h('button', { type: 'button', class: 'btn secondary sm', onClick: () => openPaymentSheet(d) }, 'Pagar'))
  );
}

export function debtsView() {
  const page = h('div', { class: 'page' }, h('h1', { class: 'h-large' }, 'Deudas'));
  const debts = state.debts;
  if (!debts.length) {
    page.append(emptyState({ emoji: '💳', title: 'Sin deudas registradas', text: 'Si le debes plata a un banco, una tarjeta o una persona, anótala aquí para ver cuánto falta y cuándo toca pagar.', actionLabel: 'Agregar deuda', onAction: () => openDebtSheet() }));
    return page;
  }
  const dt = debtTotals();
  const p = Math.round(dt.pct * 100);
  page.append(
    h(
      'section',
      { class: 'hero debt-hero' },
      h('div', { class: 'hero-label' }, dt.active ? 'Debes en total' : 'Ya no debes nada'),
      h('div', { class: 'hero-amt' }, bigMoney(dt.remaining)),
      h('div', { class: 'progress', role: 'img', 'aria-label': `${p} % pagado` }, h('i', { style: { width: p + '%' } })),
      h('div', { class: 'hero-split' }, h('div', null, 'Pagado', h('b', null, `${p} %`)), dt.monthly ? h('div', { style: { textAlign: 'right' } }, 'Cuotas al mes', h('b', null, money(dt.monthly))) : null)
    )
  );
  const sorted = [...debts].sort((a, b) => {
    const ia = debtInfo(a);
    const ib = debtInfo(b);
    if (ia.done !== ib.done) return ia.done ? 1 : -1;
    return (ib.remaining || 0) - (ia.remaining || 0);
  });
  const active = sorted.filter((d) => !debtInfo(d).done);
  const done = sorted.filter((d) => debtInfo(d).done);
  if (active.length) page.append(section('En curso'), h('div', null, active.map(debtCard)));
  if (done.length) page.append(section('Saldadas'), h('div', null, done.map(debtCard)));
  page.append(h('p', { class: 'note' }, 'Cada pago que registras aquí también cuenta como gasto en tu resumen del mes.'));
  return page;
}

export const debtsNavActions = () => [iconBtn('plus', 'Nueva deuda', () => openDebtSheet())];
