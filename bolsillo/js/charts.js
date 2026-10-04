// Gráficos hechos a mano en SVG (sin librerías): dona de gastos y barras por mes.

import { h, s, money, compact, monthShort, monthLabel, cap, pct } from './util.js';

// ---------- Dona ----------
/**
 * items: [{ label, value, color }]
 * Toca un segmento para ver su detalle en el centro; tócalo otra vez para volver al total.
 */
export function donut({ items, totalLabel = 'Gastos', onSelect }) {
  const size = 184;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  const total = items.reduce((a, i) => a + i.value, 0);
  const gap = items.length > 1 ? 3 : 0;

  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': `${totalLabel}: ${money(total)}` });
  svg.appendChild(s('circle', { cx: mid, cy: mid, r, fill: 'none', stroke: 'var(--fill)', 'stroke-width': stroke }));

  const tEl = h('div', { class: 't' }, totalLabel);
  const vEl = h('div', { class: 'v' });
  const setV = (n) => {
    const txt = money(n);
    vEl.textContent = txt;
    vEl.classList.toggle('sm', txt.length > 11);
  };
  setV(total);
  const sEl = h('div', { class: 's' }, ' ');
  const center = h('div', { class: 'donut-center' }, tEl, vEl, sEl);
  const wrap = h('div', { class: 'donut-wrap' }, svg, center);

  let selected = -1;
  const segs = [];
  let acc = 0;
  items.forEach((it, i) => {
    const frac = it.value / total;
    const len = Math.max(frac * c - gap, 0.8);
    const seg = s(
      'circle',
      {
        class: 'seg',
        cx: mid,
        cy: mid,
        r,
        fill: 'none',
        stroke: it.color,
        'stroke-width': stroke,
        'stroke-dasharray': `${len} ${c - len}`,
        'stroke-dashoffset': -(acc * c + gap / 2),
        transform: `rotate(-90 ${mid} ${mid})`,
      },
      s('title', null, `${it.label}: ${money(it.value)} (${pct(it.value, total)} %)`)
    );
    seg.addEventListener('click', () => select(selected === i ? -1 : i));
    segs.push(seg);
    svg.appendChild(seg);
    acc += frac;
  });

  function select(i) {
    selected = i;
    segs.forEach((sg, k) => sg.classList.toggle('sel', k === i));
    wrap.classList.toggle('has-sel', i >= 0);
    if (i >= 0) {
      tEl.textContent = items[i].label;
      setV(items[i].value);
      sEl.textContent = pct(items[i].value, total) + ' % de tus gastos';
    } else {
      tEl.textContent = totalLabel;
      setV(total);
      sEl.textContent = ' ';
    }
    if (onSelect) onSelect(i);
  }
  return { el: wrap, select };
}

// ---------- Barras: ingresos y gastos por mes ----------
function niceMax(v) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = [1, 2, 4, 6, 8, 10].find((x) => f <= x) || 10;
  return n * exp;
}

function topRound(x, y, w, hgt, r) {
  if (hgt <= 0) return '';
  r = Math.min(r, hgt, w / 2);
  return `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
}

/** data: [{ ym, income, expense }] (del más viejo al más nuevo). Tocar un mes lo selecciona. */
export function bars(data, { selected, onSelect }) {
  const W = 340;
  const H = 176;
  const ml = 40;
  const mr = 2;
  const mt = 10;
  const mb = 26;
  const pw = W - ml - mr;
  const ph = H - mt - mb;
  const maxV = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const top = niceMax(maxV);
  const y = (v) => mt + ph - (v / top) * ph;
  const slot = pw / data.length;
  const bw = 12;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Ingresos y gastos de los últimos meses' });

  [0, 0.5, 1].forEach((f) => {
    const v = top * f;
    svg.appendChild(s('line', { class: 'gl', x1: ml, x2: W - mr, y1: y(v), y2: y(v) }));
    svg.appendChild(s('text', { class: 'tick', x: ml - 7, y: y(v) + 3.5, 'text-anchor': 'end' }, v === 0 ? '0' : compact(v)));
  });

  data.forEach((d, i) => {
    const cx = ml + slot * i + slot / 2;
    const on = d.ym === selected;
    const g = s('g', { class: 'slot' + (on ? ' on' : ''), role: 'button', tabindex: '0', 'aria-label': `${cap(monthLabel(d.ym))}: ingresos ${money(d.income)}, gastos ${money(d.expense)}` });
    g.appendChild(s('rect', { class: 'slot-bg', x: cx - slot / 2 + 2, y: mt - 4, width: slot - 4, height: ph + 8, rx: 10 }));

    const barH = (v) => (v > 0 ? Math.max(2, (v / top) * ph) : 0);
    const hi = barH(d.income);
    const he = barH(d.expense);
    if (hi) g.appendChild(s('path', { class: 'b-inc', d: topRound(cx - bw - 1, mt + ph - hi, bw, hi, 4) }));
    if (he) g.appendChild(s('path', { class: 'b-exp', d: topRound(cx + 1, mt + ph - he, bw, he, 4) }));

    g.appendChild(s('text', { class: 'mlabel' + (on ? ' on' : ''), x: cx, y: H - 7, 'text-anchor': 'middle' }, monthShort(d.ym)));
    g.appendChild(s('rect', { x: cx - slot / 2, y: 0, width: slot, height: H, fill: 'transparent' }));
    g.appendChild(s('title', null, `${cap(monthLabel(d.ym))} · ingresos ${money(d.income)} · gastos ${money(d.expense)}`));
    const pick = () => onSelect && onSelect(d.ym);
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    });
    svg.appendChild(g);
  });
  return svg;
}
