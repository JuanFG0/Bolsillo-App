// Piezas de interfaz reutilizables: íconos, hojas (sheets), alertas, avisos, controles.

import { h, parseAmount, num, tint } from './util.js';

// ---------- Íconos (trazo, estilo SF Symbols) ----------
const P = {
  pie: '<path d="M12 3.2a8.8 8.8 0 1 0 8.8 8.8H12z"/><path d="M15 3.6a8.8 8.8 0 0 1 5.4 5.4H15z"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.6 6.5h.01M4.6 12h.01M4.6 17.5h.01" stroke-width="2.6"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h3.5"/>',
  sliders: '<path d="M4 7h8M17 7h3M4 17h3M12 17h8"/><circle cx="14.5" cy="7" r="2.3"/><circle cx="9.5" cy="17" r="2.3"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke-width="2.4"/>',
  left: '<path d="M14.5 6l-6 6 6 6"/>',
  right: '<path d="M9.5 6l6 6-6 6"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.2"/><path d="M15.5 15.5L20 20"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  xfill: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="M9 9l6 6M15 9l-6 6" stroke="var(--bg)"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.4"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7"/>',
  share: '<path d="M12 15V3.5M8 7.2l4-4 4 4"/><path d="M6 11.5H5.5A1.5 1.5 0 0 0 4 13v6a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-6a1.5 1.5 0 0 0-1.5-1.5H18"/>',
  import: '<path d="M12 3.5V15M8 11.3l4 4 4-4"/><path d="M6 11.5H5.5A1.5 1.5 0 0 0 4 13v6a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-6a1.5 1.5 0 0 0-1.5-1.5H18"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.8"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
  moon: '<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8a8.2 8.2 0 0 0 0 16.4z" fill="currentColor"/>',
  tag: '<path d="M3.5 12.2V4.5h7.7l9.3 9.3a1.6 1.6 0 0 1 0 2.2l-5.5 5.5a1.6 1.6 0 0 1-2.2 0z"/><circle cx="7.8" cy="8.8" r="1.1" fill="currentColor"/>',
  book: '<path d="M5.5 4h11A2.5 2.5 0 0 1 19 6.5V20H8a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M5.5 17.5A2.5 2.5 0 0 1 8 15h11"/>',
  shield: '<path d="M12 3l7.5 2.8v5.7c0 4.6-3.2 7.7-7.5 9.5-4.3-1.8-7.5-4.9-7.5-9.5V5.8z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.9h.01" stroke-width="2.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/>',
  note: '<path d="M5 5h14v10l-4 4H5z"/><path d="M15 19v-4h4M8.5 9.5h7M8.5 12.5h4"/>',
  backspace: '<path d="M9 5.5h10.5A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5H9L3 12z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><path d="M4 7.5V17a2.5 2.5 0 0 0 2.5 2.5h12A1.5 1.5 0 0 0 20 18V9.5A1.5 1.5 0 0 0 18.5 8h-12A2.5 2.5 0 0 1 4 7.5z"/><circle cx="16" cy="13.5" r="1.1" fill="currentColor"/>',
  alert: '<path d="M12 4.2l9 15.3H3z"/><path d="M12 10v4.4M12 17.3h.01" stroke-width="2.2"/>',
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = P[name] || '';
  return svg;
}

// ---------- Teclado y viewport (para que las hojas no queden tapadas) ----------
export function trackViewport() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const update = () => {
    const vh = vv ? vv.height : window.innerHeight;
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    root.style.setProperty('--vvh', vh + 'px');
    root.style.setProperty('--kb', kb + 'px');
  };
  if (vv) {
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
  }
  window.addEventListener('resize', update);
  update();
}

// ---------- Hojas (sheets) ----------
const stack = [];
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
});

export function linkBtn(label, onClick, { strong = false, disabled = false } = {}) {
  return h('button', { type: 'button', class: 'link' + (strong ? ' strong' : ''), disabled, onClick }, label);
}

export function iconBtn(name, label, onClick) {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, onClick }, icon(name));
}

/**
 * Abre una hoja desde abajo.
 * left/right: nodos (usa linkBtn). body: nodo. footer: nodo opcional (botón principal).
 * Devuelve { el, body, close, setTitle, setRight }.
 */
export function openSheet({ title = '', left = null, right = null, body, footer = null, onClose = null, flush = false }) {
  const layer = h('div', { class: 'layer' });
  const backdrop = h('div', { class: 'backdrop' });
  const grabber = h('div', { class: 'grabber', style: { touchAction: 'none' } });
  const titleEl = h('div', { class: 'sheet-title' }, title);
  const hd = h('div', { class: 'sheet-hd' }, left || h('span'), titleEl, right || h('span'));
  const bodyEl = h('div', { class: 'sheet-body' + (flush ? ' flush' : '') }, body);
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' }, grabber, hd, bodyEl, footer ? h('div', { class: 'sheet-foot' }, footer) : null);
  layer.append(backdrop, sheet);
  document.getElementById('layers').appendChild(layer);

  let closed = false;
  const ctl = {
    el: sheet,
    body: bodyEl,
    close(result) {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(ctl);
      if (i >= 0) stack.splice(i, 1);
      layer.classList.remove('in');
      layer.style.pointerEvents = 'none';
      setTimeout(() => {
        layer.remove();
        if (onClose) onClose(result);
      }, 400);
    },
    setTitle(t) {
      titleEl.textContent = t;
    },
    setRight(node) {
      hd.lastElementChild.replaceWith(node);
    },
  };
  stack.push(ctl);

  backdrop.addEventListener('click', () => ctl.close());

  // Arrastrar hacia abajo para cerrar
  let startY = 0;
  let dy = 0;
  let t0 = 0;
  let dragging = false;
  const down = (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    startY = e.clientY;
    dy = 0;
    t0 = Date.now();
    layer.classList.add('dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
    backdrop.style.opacity = String(Math.max(0, 1 - dy / 520));
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    layer.classList.remove('dragging');
    const fast = dy / Math.max(1, Date.now() - t0) > 0.6;
    sheet.style.transform = '';
    backdrop.style.opacity = '';
    if (dy > 110 || fast) ctl.close();
  };
  for (const el of [grabber, hd]) {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // Si se abre el teclado, deja el campo a la vista
  sheet.addEventListener('focusin', (e) => {
    if (e.target.matches('input[type="text"], input[type="search"], input:not([type])')) {
      setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
    }
  });

  requestAnimationFrame(() => {
    layer.getBoundingClientRect();
    layer.classList.add('in');
  });
  return ctl;
}

// ---------- Alertas (confirmaciones) ----------
function alertDialog({ title, message = '', buttons, column = false }) {
  return new Promise((resolve) => {
    const layer = h('div', { class: 'alert-layer' });
    const finish = (value) => {
      layer.classList.remove('in');
      setTimeout(() => layer.remove(), 260);
      resolve(value);
    };
    const btns = h(
      'div',
      { class: 'alert-btns' + (column ? ' col' : '') },
      buttons.map((b) => h('button', { type: 'button', class: [b.strong ? 'strong' : '', b.destructive ? 'destructive' : ''].join(' ').trim(), onClick: () => finish(b.value) }, b.label))
    );
    const box = h('div', { class: 'alert', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'alert-body' }, h('div', { class: 'alert-title' }, title), message ? h('div', { class: 'alert-msg' }, message) : null), btns);
    const backdrop = h('div', { class: 'backdrop' });
    layer.append(backdrop, box);
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('in'));
  });
}

export function confirmDialog({ title, message = '', confirmText = 'Aceptar', cancelText = 'Cancelar', destructive = false }) {
  return alertDialog({
    title,
    message,
    buttons: [
      { label: cancelText, value: false },
      { label: confirmText, value: true, strong: true, destructive },
    ],
  });
}

export function infoDialog({ title, message, okText = 'Entendido' }) {
  return alertDialog({ title, message, buttons: [{ label: okText, value: true, strong: true }] });
}

/** Varias opciones en columna. Devuelve el value elegido o null si cancela. */
export function chooseDialog({ title, message = '', options, cancelText = 'Cancelar' }) {
  return alertDialog({
    title,
    message,
    column: true,
    buttons: [...options.map((o) => ({ label: o.label, value: o.value, destructive: o.destructive, strong: o.strong })), { label: cancelText, value: null }],
  });
}

// ---------- Avisos ----------
let toastWrap = null;
export function toast(message, { action = null, ms = 3200 } = {}) {
  if (!toastWrap) {
    toastWrap = h('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastWrap);
  }
  const el = h('div', { class: 'toast' }, h('span', null, message));
  let timer;
  const hide = () => {
    clearTimeout(timer);
    el.classList.remove('in');
    setTimeout(() => el.remove(), 400);
  };
  if (action) {
    el.appendChild(
      h(
        'button',
        {
          type: 'button',
          onClick: () => {
            action.onClick();
            hide();
          },
        },
        action.label
      )
    );
  }
  toastWrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  timer = setTimeout(hide, action ? Math.max(ms, 5000) : ms);
}

// ---------- Controles ----------
export function segmented(options, value, onChange) {
  const buttons = options.map((o) =>
    h(
      'button',
      {
        type: 'button',
        class: o.value === value ? 'on' : '',
        'aria-pressed': o.value === value ? 'true' : 'false',
        onClick: () => {
          buttons.forEach((b, i) => {
            const on = options[i].value === o.value;
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          onChange(o.value);
        },
      },
      o.label
    )
  );
  return h('div', { class: 'seg', role: 'group' }, buttons);
}

export function switchEl(checked, onChange, label) {
  const input = h('input', { type: 'checkbox', checked, 'aria-label': label, onChange: () => onChange(input.checked) });
  return h('label', { class: 'switch' }, input, h('span'));
}

export function bubble({ emoji, color, ico, size = '' }) {
  if (emoji) return h('span', { class: 'bubble ' + size, style: { background: tint(color || '#9A9AA0', 0.2) }, 'aria-hidden': 'true' }, emoji);
  return h('span', { class: 'bubble mono ' + size, 'aria-hidden': 'true' }, icon(ico));
}

/** Fila de lista estilo iOS. */
export function row({ emoji, color, ico, title, sub, right, rightClass = '', chevron = false, onClick, danger = false, flush = false, wrap = false, ariaLabel }) {
  const lead = emoji || ico ? bubble({ emoji, color, ico }) : null;
  const children = [
    lead,
    h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, title), sub ? h('div', { class: 'row-sub' + (wrap ? ' wrap' : '') }, sub) : null),
    right != null || chevron ? h('div', { class: 'row-right ' + rightClass }, right, chevron ? h('span', { class: 'chev' }, icon('right')) : null) : null,
  ];
  const cls = 'row' + (danger ? ' danger' : '') + (flush || !lead ? ' flush' : '');
  return onClick ? h('button', { type: 'button', class: cls, onClick, 'aria-label': ariaLabel }, children) : h('div', { class: cls }, children);
}

export function emptyState({ emoji, title, text, actionLabel, onAction }) {
  return h('div', { class: 'empty' }, h('div', { class: 'em', 'aria-hidden': 'true' }, emoji), h('h3', null, title), h('p', null, text), actionLabel ? h('button', { type: 'button', class: 'btn', onClick: onAction }, actionLabel) : null);
}

/** Campo de dinero: escribe solo números y los muestra con puntos de miles. */
export function moneyInput({ value = 0, placeholder = '0', onInput, label = '' }) {
  const el = h('input', { type: 'text', inputmode: 'numeric', enterkeyhint: 'done', autocomplete: 'off', placeholder, 'aria-label': label });
  if (value) el.value = num(value);
  el.addEventListener('input', () => {
    const n = parseAmount(el.value);
    el.value = n ? num(n) : '';
    if (onInput) onInput(n);
  });
  return el;
}
