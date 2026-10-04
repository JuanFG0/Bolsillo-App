// Utilidades pequeñas: DOM, formato de dinero y fechas (todo en español de Colombia).

// ---------- DOM ----------
const NS_SVG = 'http://www.w3.org/2000/svg';

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

function applyProps(el, props) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
}

/** Crea un elemento HTML. El texto siempre entra como texto (nunca como HTML). */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, kids);
  return el;
}

/** Reemplaza el contenido de un elemento ignorando null/false (replaceChildren escribiría "null"). */
export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
}

/** Crea un elemento SVG. */
export function s(tag, props, ...kids) {
  const el = document.createElementNS(NS_SVG, tag);
  applyProps(el, props);
  append(el, kids);
  return el;
}

// ---------- Dinero (COP, sin decimales) ----------
const group = (n) => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 1250000 -> "1.250.000" */
export const num = (n) => group(n);

/** 1250000 -> "$ 1.250.000" · -45000 -> "−$ 45.000" */
export const money = (n) => (n < 0 ? '−' : '') + '$ ' + group(n);

/** Con signo explícito para listas: ingreso "+$ 1.000", gasto "−$ 1.000" */
export const signed = (n, type) => (type === 'ingreso' ? '+' : '−') + '$ ' + group(n);

/** Compacto para ejes de gráficos: 1500000 -> "1,5 M", 350000 -> "350 mil" */
export function compact(n) {
  n = Math.abs(n);
  if (n >= 1e6) {
    const v = n / 1e6;
    return (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')) + ' M';
  }
  if (n >= 1e3) return Math.round(n / 1e3) + ' mil';
  return String(Math.round(n));
}

/** Convierte lo que escribe la persona ("1.250.000") en número entero. */
export const parseAmount = (str) => {
  const digits = String(str ?? '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

export const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// ---------- Fechas (siempre texto local "AAAA-MM-DD") ----------
export const pad = (n) => String(n).padStart(2, '0');

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const curYM = () => todayStr().slice(0, 7);
export const ymOf = (ds) => ds.slice(0, 7);

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function addDays(ds, n) {
  const d = dateFromStr(ds);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const dateFromStr = (ds) => {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const daysInMonth = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const monthName = (ym) => MESES[+ym.slice(5, 7) - 1];
export const monthShort = (ym) => MESES_CORTO[+ym.slice(5, 7) - 1];
export const monthLabel = (ym) => `${monthName(ym)} ${ym.slice(0, 4)}`;
export const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** "Hoy", "Ayer" o "sáb 3 oct" (agrega el año si no es el actual). */
export function dayLabel(ds) {
  const t = todayStr();
  if (ds === t) return 'Hoy';
  if (ds === addDays(t, -1)) return 'Ayer';
  const d = dateFromStr(ds);
  const base = `${DIAS_CORTO[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** Diferencia en días entre dos fechas "AAAA-MM-DD" (b - a). */
export function diffDays(a, b) {
  return Math.round((dateFromStr(b) - dateFromStr(a)) / 86400000);
}

// ---------- Varios ----------
export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** "#5B7CFA" + 0.16 -> "#5B7CFA29" (para fondos suaves detrás de los emojis) */
export function tint(hex, alpha = 0.16) {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex + a : hex;
}

export const debounce = (fn, ms = 200) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

/** Texto sin tildes y en minúscula, para buscar. */
export const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
