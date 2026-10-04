// Hojas de captura: movimientos, categorías, deudas y pagos, más la guía de conceptos.

import { h, fill, money, num, parseAmount, todayStr, dayLabel } from './util.js';
import {
  state,
  getCat,
  categoriesOf,
  categoryUsage,
  canDeleteCategory,
  saveCategory,
  removeCategory,
  saveMovement,
  removeMovement,
  saveDebt,
  removeDebt,
  debtInfo,
  subscribe,
  DEBT_CAT,
} from './store.js';
import { openSheet, linkBtn, confirmDialog, toast, segmented, bubble, row, icon, moneyInput } from './ui.js';

const field = (label, input, { prefix = '', suffix = '' } = {}) =>
  h('div', { class: 'field' + (prefix ? ' has-pre' : '') }, h('label', null, label), prefix ? h('span', { class: 'hint pre' }, prefix) : null, input, suffix ? h('span', { class: 'hint' }, suffix) : null);

function datePill(value, onChange) {
  const label = h('span', null, dayLabel(value));
  const input = h('input', { type: 'date', value, max: todayStr(), 'aria-label': 'Fecha' });
  input.addEventListener('change', () => {
    if (!input.value) return;
    onChange(input.value);
    label.textContent = dayLabel(input.value);
  });
  return h('label', { class: 'pill' }, icon('calendar'), label, input);
}

const firstGrapheme = (t) => {
  if (!t) return '';
  if (window.Intl && Intl.Segmenter) {
    const it = new Intl.Segmenter().segment(t)[Symbol.iterator]().next();
    return it.done ? '' : it.value.segment;
  }
  return Array.from(t)[0] || '';
};

// =====================================================================
// Movimiento (gasto o ingreso)
// =====================================================================
export function openMovementSheet(existing = null, preset = {}) {
  if (existing && existing.debtId) {
    const debt = state.debts.find((d) => d.id === existing.debtId);
    if (debt) return openPaymentSheet(debt, existing);
  }
  const editing = !!existing;
  const st = {
    type: existing ? existing.type : preset.type || 'gasto',
    digits: existing ? String(existing.amount) : '',
    categoryId: existing ? existing.categoryId : preset.categoryId || null,
    date: existing ? existing.date : todayStr(),
  };

  const validCat = (id, type) => {
    const c = state.categories.find((x) => x.id === id);
    return c && c.type === type && !(c.system && !(existing && existing.categoryId === c.id));
  };
  const defaultCat = (type) => {
    const last = state.settings.lastCat[type];
    if (validCat(last, type)) return last;
    const list = categoriesOf(type, { includeSystem: false });
    return list.length ? list[0].id : null;
  };
  if (!validCat(st.categoryId, st.type)) st.categoryId = defaultCat(st.type);

  const amountEl = h('div', { class: 'amt', 'aria-live': 'polite' });
  const strip = h('div', { class: 'catstrip', role: 'listbox', 'aria-label': 'Categoría' });
  const noteInput = h('input', { type: 'text', class: 'text', placeholder: 'Nota (opcional)', maxlength: '100', value: existing ? existing.note : '', 'aria-label': 'Nota', enterkeyhint: 'done' });
  const saveBtn = h('button', { type: 'button', class: 'btn' });
  let saving = false;

  const amountNum = () => (st.digits ? parseInt(st.digits, 10) : 0);

  function renderAmount() {
    amountEl.className = 'amt' + (st.digits ? '' : ' empty-amt');
    amountEl.replaceChildren(h('span', { class: 'cur' }, '$'), h('span', { class: 'digits' }, st.digits ? num(amountNum()) : '0'));
  }

  function renderSave() {
    saveBtn.textContent = editing ? 'Guardar cambios' : st.type === 'gasto' ? 'Guardar gasto' : 'Guardar ingreso';
    saveBtn.disabled = !(amountNum() > 0 && st.categoryId);
  }

  function renderCats() {
    const cats = categoriesOf(st.type, { includeSystem: false });
    if (existing && existing.type === st.type) {
      const cur = getCat(existing.categoryId);
      if (cur.system && !cats.some((c) => c.id === cur.id)) cats.unshift(cur);
    }
    strip.replaceChildren(
      ...cats.map((c) =>
        h(
          'button',
          {
            type: 'button',
            class: 'catchip' + (c.id === st.categoryId ? ' on' : ''),
            role: 'option',
            'aria-selected': c.id === st.categoryId ? 'true' : 'false',
            onClick: () => {
              st.categoryId = c.id;
              renderCats();
              renderSave();
            },
          },
          bubble({ emoji: c.emoji, color: c.color }),
          h('span', { class: 'n' }, c.name)
        )
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'catchip add',
          onClick: () =>
            openCategorySheet({
              type: st.type,
              onSaved: (cat) => {
                st.categoryId = cat.id;
                renderCats();
                renderSave();
              },
            }),
        },
        h('span', { class: 'bubble' }, icon('plus')),
        h('span', { class: 'n' }, 'Nueva')
      )
    );
    requestAnimationFrame(() => {
      const on = strip.querySelector('.catchip.on');
      if (on) strip.scrollLeft = Math.max(0, on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2);
    });
  }

  function press(k) {
    if (k === 'back') st.digits = st.digits.slice(0, -1);
    else {
      if (!st.digits && (k === '0' || k === '000')) return;
      if ((st.digits + k).length > 11) return;
      st.digits += k;
    }
    renderAmount();
    renderSave();
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'];
  const keypad = h(
    'div',
    { class: 'keypad' },
    keys.map((k) =>
      h(
        'button',
        { type: 'button', class: 'key' + (k === '000' ? ' small' : ''), 'aria-label': k === 'back' ? 'Borrar' : k, onClick: () => press(k) },
        k === 'back' ? icon('backspace') : k
      )
    )
  );

  const typeSeg = segmented(
    [
      { value: 'gasto', label: 'Gasto' },
      { value: 'ingreso', label: 'Ingreso' },
    ],
    st.type,
    (v) => {
      st.type = v;
      if (!validCat(st.categoryId, v)) st.categoryId = defaultCat(v);
      renderCats();
      renderSave();
    }
  );

  const metaRow = h('div', { class: 'meta-row' }, datePill(st.date, (d) => (st.date = d)), h('label', { class: 'pill grow' }, icon('note'), noteInput));

  const body = h('div', null, typeSeg, amountEl, strip, metaRow, keypad);

  // Eliminar (solo al editar)
  if (editing) {
    body.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn danger',
          onClick: async () => {
            const ok = await confirmDialog({ title: '¿Eliminar este movimiento?', message: `${existing.type === 'gasto' ? 'Gasto' : 'Ingreso'} de ${money(existing.amount)}.`, confirmText: 'Eliminar', destructive: true });
            if (!ok) return;
            const removed = await removeMovement(existing.id);
            ctl.close();
            if (removed) toast('Movimiento eliminado', { action: { label: 'Deshacer', onClick: () => saveMovement(removed) } });
          },
        },
        'Eliminar movimiento'
      )
    );
  }

  saveBtn.addEventListener('click', () => {
    if (saving || saveBtn.disabled) return;
    saving = true;
    const amount = amountNum();
    saveMovement({ id: existing ? existing.id : undefined, type: st.type, amount, categoryId: st.categoryId, date: st.date, note: noteInput.value, createdAt: existing ? existing.createdAt : undefined });
    ctl.close();
    toast(editing ? 'Cambios guardados' : st.type === 'gasto' ? `Gasto de ${money(amount)} guardado` : `Ingreso de ${money(amount)} guardado`);
  });

  noteInput.addEventListener('focus', () => ctl.el.classList.add('kb-open'));
  noteInput.addEventListener('blur', () => ctl.el.classList.remove('kb-open'));

  // Teclado físico (útil si la usas desde el computador)
  const onKey = (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') saveBtn.click();
  };
  document.addEventListener('keydown', onKey);

  const ctl = openSheet({
    title: editing ? 'Editar movimiento' : 'Nuevo movimiento',
    left: linkBtn('Cancelar', () => ctl.close()),
    body,
    footer: saveBtn,
    onClose: () => document.removeEventListener('keydown', onKey),
  });
  renderAmount();
  renderCats();
  renderSave();
  return ctl;
}

// =====================================================================
// Categorías
// =====================================================================
const SWATCHES = ['#5B7CFA', '#38A8E0', '#2FB6A6', '#34A26B', '#78B03C', '#A8C34A', '#E8C23A', '#F59E3B', '#D98A5B', '#EF6B5A', '#E0568A', '#B77FD9', '#8B6FE0', '#7A8594', '#9A9AA0', '#2E9CB8'];
const EMOJIS = ['🏠', '🏢', '🛏️', '🔧', '🧹', '💡', '🔌', '📶', '📱', '💻', '🛒', '🥑', '🍎', '🥩', '🍞', '☕', '🍔', '🍕', '🍽️', '🍺', '🚌', '🚕', '🚗', '⛽', '🛵', '🚲', '✈️', '🏖️', '🩺', '💊', '🦷', '🏋️', '🧘', '💇', '👕', '👟', '🛍️', '🎬', '🎮', '🎵', '📚', '🎓', '✏️', '👶', '🐶', '🐱', '🎁', '🎂', '💍', '🙏', '💳', '🏦', '💰', '💵', '🧾', '📈', '💼', '🏷️', '🧰', '🔨', '🚿', '🧴', '🌱', '🎟️', '📺', '🎨', '✨'];

export function openCategoriesSheet() {
  let type = 'gasto';
  const list = h('div');
  const render = () => {
    const cats = categoriesOf(type);
    const group = h(
      'div',
      { class: 'group' },
      cats.map((c) => {
        const used = categoryUsage(c.id);
        const bits = [];
        if (c.type === 'gasto') bits.push(c.kind === 'want' ? 'Gusto' : 'Necesidad');
        if (used) bits.push(`${used} ${used === 1 ? 'movimiento' : 'movimientos'}`);
        return row({ emoji: c.emoji, color: c.color, title: c.name, sub: bits.join(' · '), chevron: true, onClick: () => openCategorySheet({ category: c }) });
      }),
      row({ ico: 'plus', title: 'Nueva categoría', onClick: () => openCategorySheet({ type }) })
    );
    list.replaceChildren(group);
  };
  const seg = segmented(
    [
      { value: 'gasto', label: 'Gastos' },
      { value: 'ingreso', label: 'Ingresos' },
    ],
    type,
    (v) => {
      type = v;
      render();
    }
  );
  const unsub = subscribe(render);
  const ctl = openSheet({
    title: 'Categorías',
    right: linkBtn('Listo', () => ctl.close(), { strong: true }),
    body: h('div', null, h('div', { style: { marginBottom: '14px' } }, seg), list, h('p', { class: 'note' }, 'Las categorías te dicen a dónde se va cada peso. Puedes cambiar el nombre, el ícono y el color cuando quieras.')),
    onClose: unsub,
  });
  render();
  return ctl;
}

export function openCategorySheet({ category = null, type = 'gasto', onSaved = null } = {}) {
  const editing = !!category;
  const st = {
    name: category ? category.name : '',
    emoji: category ? category.emoji : '✨',
    color: category ? category.color : SWATCHES[0],
    kind: category && category.kind ? category.kind : 'need',
  };
  const catType = category ? category.type : type;

  const previewName = h('div', { class: 'name' });
  const preview = h('div', { class: 'preview' }, h('span'), previewName);
  const saveBtn = h('button', { type: 'button', class: 'btn' }, 'Guardar');

  const renderPreviewSafe = () => {
    const cur = preview.firstElementChild;
    cur.replaceWith(bubble({ emoji: st.emoji, color: st.color, size: 'lg' }));
    previewName.textContent = st.name.trim() || 'Nueva categoría';
    saveBtn.disabled = !st.name.trim();
  };

  const nameInput = h('input', { type: 'text', class: 'left', placeholder: 'Nombre', maxlength: '24', value: st.name, 'aria-label': 'Nombre', enterkeyhint: 'done' });
  nameInput.addEventListener('input', () => {
    st.name = nameInput.value;
    renderPreviewSafe();
  });

  const emojiGrid = h('div', { class: 'emoji-grid' });
  const renderEmojis = () =>
    emojiGrid.replaceChildren(
      ...EMOJIS.map((e) =>
        h(
          'button',
          {
            type: 'button',
            class: e === st.emoji ? 'on' : '',
            'aria-label': e,
            onClick: () => {
              st.emoji = e;
              renderEmojis();
              renderPreviewSafe();
            },
          },
          e
        )
      )
    );
  const customEmoji = h('input', { type: 'text', class: 'emoji-input', placeholder: 'O escribe o pega uno propio', 'aria-label': 'Emoji propio' });
  customEmoji.addEventListener('input', () => {
    const g = firstGrapheme(customEmoji.value.trim());
    if (g) {
      st.emoji = g;
      renderEmojis();
      renderPreviewSafe();
    }
  });

  const swatchEl = h('div', { class: 'swatches' });
  const renderSwatches = () =>
    swatchEl.replaceChildren(
      ...SWATCHES.map((c) =>
        h('button', {
          type: 'button',
          class: 'sw' + (c === st.color ? ' on' : ''),
          style: { background: c },
          'aria-label': 'Color ' + c,
          onClick: () => {
            st.color = c;
            renderSwatches();
            renderPreviewSafe();
          },
        })
      )
    );

  const groups = [h('div', { class: 'group' }, h('div', { class: 'field' }, nameInput))];

  if (catType === 'gasto') {
    const seg = segmented(
      [
        { value: 'need', label: 'Necesidad' },
        { value: 'want', label: 'Gusto' },
      ],
      st.kind,
      (v) => (st.kind = v)
    );
    groups.push(h('div', { class: 'group', style: { marginTop: '14px' } }, h('div', { class: 'field-block' }, h('span', { class: 'lbl' }, 'Tipo de gasto'), seg)));
    groups.push(h('p', { class: 'note' }, 'Necesidad: lo que tienes que pagar (arriendo, mercado, transporte). Gusto: lo que puedes recortar (salidas, compras). Se usa en la regla 50/30/20 del resumen.'));
  }

  groups.push(h('div', { class: 'group', style: { marginTop: '14px' } }, h('div', { class: 'field-block' }, h('span', { class: 'lbl' }, 'Ícono'), customEmoji, emojiGrid)));
  groups.push(h('div', { class: 'group', style: { marginTop: '14px' } }, h('div', { class: 'field-block' }, h('span', { class: 'lbl' }, 'Color'), swatchEl)));

  const body = h('div', null, preview, groups);

  if (editing && canDeleteCategory(category)) {
    body.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn danger',
          style: { marginTop: '14px' },
          onClick: async () => {
            const used = categoryUsage(category.id);
            if (!used) {
              const ok = await confirmDialog({ title: `¿Eliminar "${category.name}"?`, confirmText: 'Eliminar', destructive: true });
              if (!ok) return;
              const target = categoriesOf(category.type).find((c) => c.id !== category.id);
              await removeCategory(category.id, target.id);
              ctl.close();
              toast('Categoría eliminada');
            } else {
              openReassignSheet(category, () => ctl.close());
            }
          },
        },
        'Eliminar categoría'
      )
    );
  } else if (editing && category.system) {
    body.appendChild(h('p', { class: 'note' }, 'Esta categoría la usa la app para registrar los pagos de tus deudas, por eso no se puede eliminar.'));
  }

  saveBtn.addEventListener('click', async () => {
    if (saveBtn.disabled) return;
    const cat = await saveCategory({ id: category ? category.id : undefined, name: st.name, emoji: st.emoji, color: st.color, kind: st.kind, type: catType });
    ctl.close();
    if (onSaved) onSaved(cat);
    else toast(editing ? 'Categoría actualizada' : 'Categoría creada');
  });

  const ctl = openSheet({
    title: editing ? 'Editar categoría' : 'Nueva categoría',
    left: linkBtn('Cancelar', () => ctl.close()),
    body,
    footer: saveBtn,
  });
  renderEmojis();
  renderSwatches();
  renderPreviewSafe();
  return ctl;
}

function openReassignSheet(category, onDone) {
  const used = categoryUsage(category.id);
  const options = categoriesOf(category.type).filter((c) => c.id !== category.id);
  const group = h(
    'div',
    { class: 'group' },
    options.map((c) =>
      row({
        emoji: c.emoji,
        color: c.color,
        title: c.name,
        onClick: async () => {
          const ok = await confirmDialog({
            title: `¿Mover ${used} ${used === 1 ? 'movimiento' : 'movimientos'} a "${c.name}"?`,
            message: `Se eliminará "${category.name}" y sus movimientos quedarán en "${c.name}".`,
            confirmText: 'Mover y eliminar',
            destructive: true,
          });
          if (!ok) return;
          await removeCategory(category.id, c.id);
          ctl.close();
          onDone();
          toast('Categoría eliminada');
        },
      })
    )
  );
  const ctl = openSheet({
    title: 'Mover movimientos a…',
    left: linkBtn('Cancelar', () => ctl.close()),
    body: h('div', null, h('p', { class: 'note', style: { margin: '0 4px 12px' } }, `"${category.name}" tiene ${used} ${used === 1 ? 'movimiento' : 'movimientos'}. Elige a qué categoría pasarlos para no perderlos.`), group),
  });
}

// =====================================================================
// Deudas y pagos
// =====================================================================
export function openDebtSheet(existing = null) {
  const editing = !!existing;
  const st = {
    name: existing ? existing.name : '',
    total: existing ? existing.total : 0,
    initialPaid: existing ? existing.initialPaid : 0,
    monthly: existing ? existing.monthly : 0,
    dueDay: existing && existing.dueDay ? existing.dueDay : 0,
  };
  const saveBtn = h('button', { type: 'button', class: 'btn' }, editing ? 'Guardar cambios' : 'Guardar deuda');
  const refresh = () => (saveBtn.disabled = !(st.name.trim() && st.total > 0));

  const nameInput = h('input', { type: 'text', placeholder: 'Ej. Tarjeta de crédito', maxlength: '40', value: st.name, 'aria-label': 'Nombre de la deuda', enterkeyhint: 'next' });
  nameInput.addEventListener('input', () => {
    st.name = nameInput.value;
    refresh();
  });
  const total = moneyInput({ value: st.total, label: 'Monto total', onInput: (n) => ((st.total = n), refresh()) });
  const paid = moneyInput({ value: st.initialPaid, label: 'Ya pagado', onInput: (n) => (st.initialPaid = n) });
  const monthly = moneyInput({ value: st.monthly, label: 'Cuota mensual', onInput: (n) => (st.monthly = n) });
  const day = h('input', { type: 'text', inputmode: 'numeric', placeholder: '—', maxlength: '2', 'aria-label': 'Día de pago', autocomplete: 'off' });
  if (st.dueDay) day.value = String(st.dueDay);
  day.addEventListener('input', () => {
    const n = Math.min(31, parseAmount(day.value));
    day.value = n ? String(n) : '';
    st.dueDay = n;
  });

  const body = h(
    'div',
    null,
    h('div', { class: 'group' }, field('Nombre', nameInput)),
    h('div', { class: 'group', style: { marginTop: '14px' } }, field('Monto total', total, { prefix: '$' }), field('Ya pagado', paid, { prefix: '$' })),
    h('p', { class: 'note' }, 'Monto total: todo lo que tienes que pagar (si ya incluye intereses, mejor). Ya pagado: lo que pagaste antes de registrar la deuda aquí. Los pagos nuevos los anotas desde la deuda.'),
    h('div', { class: 'group', style: { marginTop: '14px' } }, field('Cuota mensual', monthly, { prefix: '$' }), field('Día de pago', day, { suffix: 'de cada mes' })),
    h('p', { class: 'note' }, 'La cuota y el día son opcionales: sirven para avisarte cuánto falta y cuándo toca pagar.')
  );

  if (editing) {
    body.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn danger',
          style: { marginTop: '14px' },
          onClick: async () => {
            const ok = await confirmDialog({ title: `¿Eliminar "${existing.name}"?`, message: 'Los pagos que ya registraste seguirán en tu historial como gastos.', confirmText: 'Eliminar deuda', destructive: true });
            if (!ok) return;
            await removeDebt(existing.id);
            ctl.close();
            toast('Deuda eliminada');
          },
        },
        'Eliminar deuda'
      )
    );
  }

  saveBtn.addEventListener('click', async () => {
    if (saveBtn.disabled) return;
    if (st.initialPaid > st.total) {
      toast('Lo ya pagado no puede ser mayor que el monto total');
      return;
    }
    await saveDebt({ id: existing ? existing.id : undefined, ...st });
    ctl.close();
    toast(editing ? 'Deuda actualizada' : 'Deuda guardada');
  });

  const ctl = openSheet({
    title: editing ? 'Editar deuda' : 'Nueva deuda',
    left: linkBtn('Cancelar', () => ctl.close()),
    body,
    footer: saveBtn,
  });
  refresh();
  return ctl;
}

export function openPaymentSheet(debt, existingMov = null) {
  const editing = !!existingMov;
  const info = debtInfo(debt);
  const st = {
    amount: existingMov ? existingMov.amount : Math.min(debt.monthly || info.remaining, info.remaining) || 0,
    date: existingMov ? existingMov.date : todayStr(),
  };
  const amountInput = moneyInput({ value: st.amount, label: 'Monto del pago', onInput: (n) => ((st.amount = n), refresh()) });
  const saveBtn = h('button', { type: 'button', class: 'btn' }, editing ? 'Guardar cambios' : 'Registrar pago');
  const refresh = () => (saveBtn.disabled = !(st.amount > 0));

  const setAmount = (n) => {
    st.amount = n;
    amountInput.value = num(n);
    refresh();
  };

  const chips = [];
  if (!editing) {
    if (debt.monthly > 0 && debt.monthly < info.remaining) chips.push(h('button', { type: 'button', class: 'chip', onClick: () => setAmount(debt.monthly) }, `Cuota ${money(debt.monthly)}`));
    if (info.remaining > 0) chips.push(h('button', { type: 'button', class: 'chip', onClick: () => setAmount(info.remaining) }, `Pagar todo ${money(info.remaining)}`));
  }

  const body = h(
    'div',
    null,
    h(
      'div',
      { class: 'group' },
      editing ? null : h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Falta por pagar'), h('span', { style: { flex: 1, textAlign: 'right', fontWeight: 600 } }, money(info.remaining))),
      field('Monto', amountInput, { prefix: '$' }),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Fecha'), h('div', { style: { flex: 1, display: 'flex', justifyContent: 'flex-end' } }, datePill(st.date, (d) => (st.date = d))))
    ),
    chips.length ? h('div', { class: 'chips', style: { marginTop: '14px' } }, chips) : null,
    h('p', { class: 'note' }, 'El pago también queda en tus movimientos como un gasto de la categoría Deudas, para que el resumen del mes sea real.')
  );

  if (editing) {
    body.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn danger',
          style: { marginTop: '14px' },
          onClick: async () => {
            const ok = await confirmDialog({ title: '¿Eliminar este pago?', message: `${money(existingMov.amount)} · ${dayLabel(existingMov.date)}`, confirmText: 'Eliminar', destructive: true });
            if (!ok) return;
            const removed = await removeMovement(existingMov.id);
            ctl.close();
            if (removed) toast('Pago eliminado', { action: { label: 'Deshacer', onClick: () => saveMovement(removed) } });
          },
        },
        'Eliminar pago'
      )
    );
  }

  saveBtn.addEventListener('click', () => {
    if (saveBtn.disabled) return;
    saveMovement({
      id: existingMov ? existingMov.id : undefined,
      type: 'gasto',
      amount: st.amount,
      categoryId: DEBT_CAT,
      date: st.date,
      note: `Pago · ${debt.name}`,
      debtId: debt.id,
      createdAt: existingMov ? existingMov.createdAt : undefined,
    });
    ctl.close();
    const after = debtInfo(debt);
    if (!editing && after.done) toast('¡Deuda saldada! 🎉');
    else toast(editing ? 'Pago actualizado' : `Pago de ${money(st.amount)} registrado`);
  });

  const ctl = openSheet({
    title: editing ? 'Editar pago' : `Pagar · ${debt.name}`,
    left: linkBtn('Cancelar', () => ctl.close()),
    body,
    footer: saveBtn,
  });
  refresh();
  return ctl;
}

export function openDebtDetail(debtId) {
  const body = h('div');
  const footer = h('div');
  let unsub = () => {};

  const render = () => {
    const debt = state.debts.find((d) => d.id === debtId);
    if (!debt) {
      ctl.close();
      return;
    }
    const info = debtInfo(debt);
    ctl.setTitle(debt.name);

    const stat = (k, v) => h('div', null, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
    const stats = h(
      'div',
      { class: 'group stats' },
      stat('Monto total', money(debt.total)),
      stat('Ya pagado', money(info.paid)),
      stat('Cuota mensual', debt.monthly ? money(debt.monthly) : '—'),
      stat('Día de pago', debt.dueDay ? `El ${debt.dueDay} de cada mes` : '—'),
      info.cuotasLeft ? stat('Cuotas que faltan', `≈ ${info.cuotasLeft}`) : null,
      info.due ? stat('Próximo pago', dayLabel(info.due)) : null
    );

    const hero = h(
      'div',
      { class: 'debt-hero', style: { textAlign: 'center', padding: '4px 0 18px' } },
      h('div', { style: { fontSize: '15px', color: 'var(--ink-2)' } }, info.done ? '¡Deuda saldada! 🎉' : 'Te falta pagar'),
      h('div', { style: { fontSize: '44px', fontWeight: 600, letterSpacing: '-0.03em', margin: '2px 0 14px' } }, money(info.remaining)),
      h('div', { class: 'progress', role: 'img', 'aria-label': `Pagado ${Math.round(info.pct * 100)} %` }, h('i', { style: { width: Math.round(info.pct * 100) + '%' } })),
      h('div', { style: { fontSize: '13px', color: 'var(--ink-2)', marginTop: '8px' } }, `${Math.round(info.pct * 100)} % pagado`)
    );

    const rows = [];
    if (debt.initialPaid > 0) rows.push(row({ ico: 'check', title: 'Pagado antes', right: money(debt.initialPaid), rightClass: 'muted' }));
    for (const m of info.payments) rows.push(row({ ico: 'check', title: dayLabel(m.date), right: money(m.amount), chevron: true, onClick: () => openPaymentSheet(debt, m) }));

    fill(body, hero, stats, rows.length ? h('div', null, h('div', { class: 'sect', style: { marginTop: '24px' } }, h('h2', { class: 'sect-title' }, 'Pagos')), h('div', { class: 'group' }, rows)) : null);

    fill(footer, info.done ? h('button', { type: 'button', class: 'btn secondary', onClick: () => ctl.close() }, 'Cerrar') : h('button', { type: 'button', class: 'btn', onClick: () => openPaymentSheet(debt) }, 'Registrar pago'));
    ctl.setRight(linkBtn('Editar', () => openDebtSheet(debt)));
  };

  const ctl = openSheet({
    title: '',
    left: linkBtn('Cerrar', () => ctl.close()),
    right: h('span'),
    body,
    footer,
    onClose: () => unsub(),
  });
  unsub = subscribe(render);
  render();
  return ctl;
}

// =====================================================================
// Guía de conceptos
// =====================================================================
const GLOSSARY = [
  ['Ingreso', 'La plata que entra: tu salario, ventas, regalos o un trabajo extra.'],
  ['Gasto', 'La plata que sale. Los fijos (arriendo, internet) casi no cambian; los variables (mercado, salidas) cambian cada mes.'],
  ['Lo que te queda', 'Ingresos menos gastos del mes. Si es positivo, te sobró plata. Si es negativo, gastaste más de lo que entró y tocó cubrirlo con ahorros o deuda.'],
  ['Necesidad y gusto', 'Necesidad es lo que no puedes dejar de pagar (vivienda, mercado, transporte, servicios, salud). Gusto es lo que puedes recortar si hace falta (salidas, compras, suscripciones).'],
  ['Regla 50/30/20', 'Una guía simple para repartir tus ingresos: hasta 50 % en necesidades, hasta 30 % en gustos y al menos 20 % para ahorrar o pagar deudas más rápido. Es una referencia, no una obligación: ajústala a tu realidad.'],
  ['Ahorro', 'La parte de tus ingresos que no gastas. En Bolsillo es lo que te queda cada mes.'],
  ['Deuda', 'Plata que debes. Lo que importa es cuánto debes en total, cuánto pagas cada mes y cuánto falta para terminar.'],
  ['Cuota', 'El pago periódico de una deuda, normalmente cada mes.'],
  ['Interés', 'Lo que te cobra el banco por prestarte plata: entre más demoras en pagar, más pagas. Las tarjetas de crédito suelen cobrar los intereses más altos, así que conviene pagarlas primero.'],
  ['Fondo de emergencia', 'Un ahorro para imprevistos (salud, un daño, quedarte sin ingresos). Una meta común es juntar entre 3 y 6 meses de tus gastos necesarios.'],
];

export function openGlossarySheet() {
  const ctl = openSheet({
    title: 'Conceptos básicos',
    right: linkBtn('Listo', () => ctl.close(), { strong: true }),
    body: h(
      'div',
      { class: 'group' },
      GLOSSARY.map(([t, d]) => h('div', { class: 'field-block', style: { borderBottom: '0.5px solid var(--line)' } }, h('div', { style: { fontWeight: 650, marginBottom: '3px' } }, t), h('div', { style: { fontSize: '15px', color: 'var(--ink-2)', lineHeight: 1.42 } }, d)))
    ),
  });
  return ctl;
}
