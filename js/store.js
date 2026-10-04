// Estado de la app: datos en memoria + guardado en IndexedDB + cálculos (selectores).
// Regla de oro: cada cambio actualiza la memoria al instante y luego se guarda en el teléfono.

import * as db from './db.js';
import { uid, todayStr, curYM, addMonths, daysInMonth, diffDays, pad } from './util.js';

// ---------- Datos de fábrica ----------
export const DEFAULT_CATS = [
  { id: 'g_vivienda', name: 'Vivienda', emoji: '🏠', color: '#5B7CFA', type: 'gasto', kind: 'need' },
  { id: 'g_mercado', name: 'Mercado', emoji: '🛒', color: '#F59E3B', type: 'gasto', kind: 'need' },
  { id: 'g_transporte', name: 'Transporte', emoji: '🚌', color: '#2FB6A6', type: 'gasto', kind: 'need' },
  { id: 'g_servicios', name: 'Servicios', emoji: '💡', color: '#E8C23A', type: 'gasto', kind: 'need' },
  { id: 'g_salud', name: 'Salud', emoji: '🩺', color: '#E0568A', type: 'gasto', kind: 'need' },
  { id: 'g_educacion', name: 'Educación', emoji: '🎓', color: '#8B6FE0', type: 'gasto', kind: 'need' },
  { id: 'g_deudas', name: 'Deudas', emoji: '💳', color: '#7A8594', type: 'gasto', kind: 'need', system: true },
  { id: 'g_comida', name: 'Comida fuera', emoji: '🍽️', color: '#EF6B5A', type: 'gasto', kind: 'want' },
  { id: 'g_ocio', name: 'Ocio', emoji: '🎬', color: '#38A8E0', type: 'gasto', kind: 'want' },
  { id: 'g_compras', name: 'Compras', emoji: '🛍️', color: '#A8C34A', type: 'gasto', kind: 'want' },
  { id: 'g_suscrip', name: 'Suscripciones', emoji: '📺', color: '#B77FD9', type: 'gasto', kind: 'want' },
  { id: 'g_regalos', name: 'Regalos', emoji: '🎁', color: '#D98A5B', type: 'gasto', kind: 'want' },
  { id: 'g_otros', name: 'Otros gastos', emoji: '✨', color: '#9A9AA0', type: 'gasto', kind: 'want' },
  { id: 'i_salario', name: 'Salario', emoji: '💼', color: '#34A26B', type: 'ingreso' },
  { id: 'i_ventas', name: 'Ventas', emoji: '🏷️', color: '#2E9CB8', type: 'ingreso' },
  { id: 'i_extras', name: 'Extras', emoji: '💸', color: '#78B03C', type: 'ingreso' },
  { id: 'i_otros', name: 'Otros ingresos', emoji: '✨', color: '#9A9AA0', type: 'ingreso' },
];

export const DEBT_CAT = 'g_deudas';
export const FALLBACK_CAT = { id: '', name: 'Sin categoría', emoji: '❔', color: '#9A9AA0', type: 'gasto', kind: 'want' };

const defaultSettings = () => ({
  theme: 'auto', // auto | light | dark
  reminder: true, // recordar respaldos
  lastBackupAt: null,
  pin: null, // { salt, hash }
  lastCat: {}, // última categoría usada por tipo
  seeded: false,
  firstUseAt: null, // cuándo se abrió la app por primera vez (para no insistir con el respaldo al inicio)
});

export const state = {
  categories: [],
  movements: [],
  debts: [],
  settings: defaultSettings(),
  ready: false,
  persisted: null,
};

// ---------- Suscripción ----------
const listeners = new Set();
let catMap = null;
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function emit() {
  catMap = null;
  listeners.forEach((fn) => fn());
}

let errorHandler = () => {};
export const setErrorHandler = (fn) => (errorHandler = fn);

async function save(fn) {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    errorHandler('No se pudo guardar en el teléfono. Haz un respaldo en cuanto puedas.');
  }
}

function mirrorTheme() {
  try {
    localStorage.setItem('bolsillo-theme', state.settings.theme);
  } catch (e) {}
}

const persistSettings = () => save(() => db.put('meta', { key: 'settings', value: state.settings }));

// ---------- Arranque ----------
export async function init() {
  await db.openDB();
  const [categories, movements, debts, meta] = await Promise.all([
    db.getAll('categories'),
    db.getAll('movements'),
    db.getAll('debts'),
    db.getAll('meta'),
  ]);
  state.categories = categories;
  state.movements = movements;
  state.debts = debts;
  const saved = meta.find((m) => m.key === 'settings');
  state.settings = { ...defaultSettings(), ...(saved ? saved.value : {}) };

  if (!state.categories.length) {
    state.categories = DEFAULT_CATS.map((c, i) => ({ ...c, order: i }));
    await save(() => db.putMany('categories', state.categories));
  }
  ensureDebtCategory();
  if (!state.settings.seeded || !state.settings.firstUseAt) {
    state.settings.seeded = true;
    if (!state.settings.firstUseAt) state.settings.firstUseAt = Date.now();
    await persistSettings();
  }
  mirrorTheme();
  state.ready = true;
  emit();
}

function ensureDebtCategory() {
  if (!state.categories.some((c) => c.id === DEBT_CAT)) {
    const def = DEFAULT_CATS.find((c) => c.id === DEBT_CAT);
    state.categories.push({ ...def, order: state.categories.length });
    save(() => db.put('categories', def));
  }
}

export async function checkPersisted() {
  try {
    if (navigator.storage && navigator.storage.persisted) {
      state.persisted = await navigator.storage.persisted();
      if (!state.persisted && navigator.storage.persist) state.persisted = await navigator.storage.persist();
    }
  } catch (e) {}
  emit();
}

export const storageVolatile = () => db.isVolatile();

// ---------- Categorías ----------
export function getCat(id) {
  if (!catMap) catMap = new Map(state.categories.map((c) => [c.id, c]));
  return catMap.get(id) || FALLBACK_CAT;
}

export function categoriesOf(type, { includeSystem = true } = {}) {
  return state.categories
    .filter((c) => c.type === type && (includeSystem || !c.system))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function categoryUsage(id) {
  return state.movements.reduce((n, m) => n + (m.categoryId === id ? 1 : 0), 0);
}

export function canDeleteCategory(c) {
  if (c.system) return false;
  return state.categories.filter((x) => x.type === c.type).length > 1;
}

export async function saveCategory(input) {
  const prev = state.categories.find((c) => c.id === input.id);
  const cat = {
    id: input.id || uid(),
    name: String(input.name).trim().slice(0, 24) || 'Sin nombre',
    emoji: input.emoji || '✨',
    color: input.color || '#9A9AA0',
    type: prev ? prev.type : input.type === 'ingreso' ? 'ingreso' : 'gasto',
    system: prev ? prev.system : undefined,
    order: prev ? prev.order : state.categories.length,
  };
  if (cat.type === 'gasto') cat.kind = input.kind === 'want' ? 'want' : 'need';
  const i = state.categories.findIndex((c) => c.id === cat.id);
  if (i >= 0) state.categories[i] = cat;
  else state.categories.push(cat);
  emit();
  await save(() => db.put('categories', cat));
  return cat;
}

/** Elimina una categoría moviendo sus movimientos a otra (reassignTo). */
export async function removeCategory(id, reassignTo) {
  const moved = [];
  for (const m of state.movements) {
    if (m.categoryId === id) {
      m.categoryId = reassignTo;
      moved.push(m);
    }
  }
  state.categories = state.categories.filter((c) => c.id !== id);
  for (const k of ['gasto', 'ingreso']) {
    if (state.settings.lastCat[k] === id) delete state.settings.lastCat[k];
  }
  emit();
  await save(async () => {
    await db.putMany('movements', moved);
    await db.remove('categories', id);
    await db.put('meta', { key: 'settings', value: state.settings });
  });
}

// ---------- Movimientos ----------
export async function saveMovement(input) {
  const mov = {
    id: input.id || uid(),
    type: input.type === 'ingreso' ? 'ingreso' : 'gasto',
    amount: Math.max(0, Math.round(input.amount)),
    categoryId: input.categoryId,
    date: input.date,
    note: String(input.note || '').trim().slice(0, 100),
    createdAt: input.createdAt || Date.now(),
  };
  if (input.debtId) mov.debtId = input.debtId;
  const i = state.movements.findIndex((m) => m.id === mov.id);
  if (i >= 0) state.movements[i] = mov;
  else state.movements.push(mov);
  if (!mov.debtId) state.settings.lastCat = { ...state.settings.lastCat, [mov.type]: mov.categoryId };
  emit();
  await save(async () => {
    await db.put('movements', mov);
    if (!mov.debtId) await db.put('meta', { key: 'settings', value: state.settings });
  });
  return mov;
}

export async function removeMovement(id) {
  const mov = state.movements.find((m) => m.id === id);
  if (!mov) return null;
  state.movements = state.movements.filter((m) => m.id !== id);
  emit();
  await save(() => db.remove('movements', id));
  return mov;
}

// ---------- Deudas ----------
export async function saveDebt(input) {
  const prev = state.debts.find((d) => d.id === input.id);
  const debt = {
    id: input.id || uid(),
    name: String(input.name).trim().slice(0, 40) || 'Deuda',
    total: Math.max(0, Math.round(input.total)),
    initialPaid: Math.max(0, Math.round(input.initialPaid || 0)),
    monthly: Math.max(0, Math.round(input.monthly || 0)),
    dueDay: input.dueDay ? Math.min(31, Math.max(1, Math.round(input.dueDay))) : null,
    createdAt: prev ? prev.createdAt : Date.now(),
  };
  const i = state.debts.findIndex((d) => d.id === debt.id);
  if (i >= 0) state.debts[i] = debt;
  else state.debts.push(debt);
  emit();
  await save(() => db.put('debts', debt));
  return debt;
}

/** Borra la deuda. Los pagos ya hechos quedan en el historial como gastos normales. */
export async function removeDebt(id) {
  const unlinked = [];
  for (const m of state.movements) {
    if (m.debtId === id) {
      delete m.debtId;
      unlinked.push(m);
    }
  }
  state.debts = state.debts.filter((d) => d.id !== id);
  emit();
  await save(async () => {
    await db.putMany('movements', unlinked);
    await db.remove('debts', id);
  });
}

// ---------- Ajustes ----------
export async function setSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  mirrorTheme();
  emit();
  await persistSettings();
}

// ---------- Selectores ----------
const inMonth = (m, ym) => m.date.slice(0, 7) === ym;

export function monthMovements(ym) {
  return state.movements.filter((m) => inMonth(m, ym)).sort(byNewest);
}

export function byNewest(a, b) {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0);
}

export function monthTotals(ym) {
  let income = 0;
  let expense = 0;
  for (const m of state.movements) {
    if (!inMonth(m, ym)) continue;
    if (m.type === 'ingreso') income += m.amount;
    else expense += m.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Gastos (o ingresos) del mes agrupados por categoría, de mayor a menor. */
export function byCategory(ym, type = 'gasto') {
  const sums = new Map();
  let total = 0;
  for (const m of state.movements) {
    if (!inMonth(m, ym) || m.type !== type) continue;
    sums.set(m.categoryId, (sums.get(m.categoryId) || 0) + m.amount);
    total += m.amount;
  }
  return [...sums.entries()]
    .map(([id, value]) => ({ cat: getCat(id), value, share: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

/** Totales de los últimos n meses terminando en ym (del más viejo al más nuevo). */
export function trend(ym, n = 6) {
  const months = [];
  for (let i = n - 1; i >= 0; i--) months.push(addMonths(ym, -i));
  const map = new Map(months.map((m) => [m, { ym: m, income: 0, expense: 0 }]));
  for (const m of state.movements) {
    const e = map.get(m.date.slice(0, 7));
    if (!e) continue;
    if (m.type === 'ingreso') e.income += m.amount;
    else e.expense += m.amount;
  }
  return months.map((m) => map.get(m));
}

/** Gastos de un mes hasta cierto día (para comparar "a esta misma fecha"). */
export function expenseUpTo(ym, day) {
  let sum = 0;
  for (const m of state.movements) {
    if (m.type === 'gasto' && inMonth(m, ym) && +m.date.slice(8, 10) <= day) sum += m.amount;
  }
  return sum;
}

/** Reparto 50/30/20: necesidades, gustos y lo que queda (ahorro). */
export function split502030(ym) {
  let need = 0;
  let want = 0;
  let income = 0;
  for (const m of state.movements) {
    if (!inMonth(m, ym)) continue;
    if (m.type === 'ingreso') income += m.amount;
    else if (getCat(m.categoryId).kind === 'need') need += m.amount;
    else want += m.amount;
  }
  return { income, need, want, saved: income - need - want };
}

export function debtInfo(d) {
  const payments = state.movements.filter((m) => m.debtId === d.id).sort(byNewest);
  const paidByApp = payments.reduce((a, m) => a + m.amount, 0);
  const paid = Math.min(d.total, (d.initialPaid || 0) + paidByApp);
  const remaining = Math.max(0, d.total - paid);
  const done = remaining === 0;
  const monthly = d.monthly || 0;
  const today = todayStr();
  const ym = curYM();
  const paidThisMonth = payments.filter((m) => inMonth(m, ym)).reduce((a, m) => a + m.amount, 0);
  const cuotaPaid = monthly > 0 ? paidThisMonth >= monthly : paidThisMonth > 0;

  let due = null;
  let daysLeft = null;
  let status = 'ok';
  if (!done && d.dueDay) {
    const dueIn = (x) => `${x}-${pad(Math.min(d.dueDay, daysInMonth(x)))}`;
    const created = new Date(d.createdAt || Date.now());
    const createdYM = `${created.getFullYear()}-${pad(created.getMonth() + 1)}`;
    const skipThisMonth = cuotaPaid || (createdYM === ym && created.getDate() > d.dueDay);
    due = skipThisMonth ? dueIn(addMonths(ym, 1)) : dueIn(ym);
    daysLeft = diffDays(today, due);
    status = daysLeft < 0 ? 'overdue' : daysLeft <= 5 ? 'soon' : 'ok';
  }

  return {
    paid,
    remaining,
    pct: d.total > 0 ? paid / d.total : 1,
    done,
    monthly,
    cuotasLeft: monthly > 0 && !done ? Math.ceil(remaining / monthly) : null,
    paidThisMonth,
    cuotaPaid,
    due,
    daysLeft,
    status,
    payments,
  };
}

export function debtTotals() {
  let remaining = 0;
  let paid = 0;
  let total = 0;
  let monthly = 0;
  let active = 0;
  for (const d of state.debts) {
    const i = debtInfo(d);
    remaining += i.remaining;
    paid += i.paid;
    total += d.total;
    if (!i.done) {
      monthly += d.monthly || 0;
      active++;
    }
  }
  return { remaining, paid, total, monthly, active, pct: total ? paid / total : 0 };
}

// ---------- Respaldo ----------
export function backupStatus() {
  const last = state.settings.lastBackupAt;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  const hasData = state.movements.length >= 3 || state.debts.length > 0;
  const sinceStart = state.settings.firstUseAt ? Math.floor((Date.now() - state.settings.firstUseAt) / 86400000) : 0;
  // Si nunca hizo un respaldo, avisa pasados 3 días de uso; si ya hizo, cada 14 días
  const due = state.settings.reminder && hasData && (last == null ? sinceStart >= 3 : days >= 14);
  return { last, days, due };
}

export async function markBackedUp() {
  await setSettings({ lastBackupAt: Date.now() });
}

export function exportData() {
  return {
    app: 'bolsillo',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: { theme: state.settings.theme, reminder: state.settings.reminder },
    categories: state.categories,
    movements: state.movements,
    debts: state.debts,
  };
}

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

/** Valida y limpia un respaldo. Lanza un Error con mensaje claro si no sirve. */
export function normalizeBackup(raw) {
  if (!raw || typeof raw !== 'object' || raw.app !== 'bolsillo' || !Array.isArray(raw.movements) || !Array.isArray(raw.categories)) {
    throw new Error('Este archivo no es un respaldo de Bolsillo.');
  }
  const categories = [];
  const seen = new Set();
  for (const c of raw.categories) {
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || seen.has(c.id)) continue;
    seen.add(c.id);
    const type = c.type === 'ingreso' ? 'ingreso' : 'gasto';
    const cat = {
      id: c.id,
      name: c.name.slice(0, 24),
      emoji: typeof c.emoji === 'string' && c.emoji ? c.emoji.slice(0, 8) : '✨',
      color: isHex(c.color) ? c.color : '#9A9AA0',
      type,
      order: Number.isFinite(c.order) ? c.order : categories.length,
    };
    if (type === 'gasto') cat.kind = c.kind === 'want' ? 'want' : 'need';
    if (c.system) cat.system = true;
    categories.push(cat);
  }
  const fallbackFor = (type) => {
    const f = categories.find((c) => c.type === type && /otros/i.test(c.name)) || categories.find((c) => c.type === type);
    return f ? f.id : null;
  };

  const movements = [];
  const ids = new Set();
  for (const m of raw.movements) {
    if (!m || typeof m.id !== 'string' || ids.has(m.id)) continue;
    const amount = Math.round(Number(m.amount));
    if (!Number.isFinite(amount) || amount <= 0 || !isDate(m.date)) continue;
    ids.add(m.id);
    const type = m.type === 'ingreso' ? 'ingreso' : 'gasto';
    const mov = {
      id: m.id,
      type,
      amount,
      categoryId: seen.has(m.categoryId) ? m.categoryId : fallbackFor(type) || m.categoryId,
      date: m.date,
      note: typeof m.note === 'string' ? m.note.slice(0, 100) : '',
      createdAt: Number.isFinite(m.createdAt) ? m.createdAt : Date.now(),
    };
    if (typeof m.debtId === 'string') mov.debtId = m.debtId;
    movements.push(mov);
  }

  const debts = [];
  const debtIds = new Set();
  for (const d of Array.isArray(raw.debts) ? raw.debts : []) {
    if (!d || typeof d.id !== 'string' || debtIds.has(d.id)) continue;
    debtIds.add(d.id);
    debts.push({
      id: d.id,
      name: String(d.name || 'Deuda').slice(0, 40),
      total: Math.max(0, Math.round(Number(d.total) || 0)),
      initialPaid: Math.max(0, Math.round(Number(d.initialPaid) || 0)),
      monthly: Math.max(0, Math.round(Number(d.monthly) || 0)),
      dueDay: d.dueDay ? Math.min(31, Math.max(1, Math.round(Number(d.dueDay)))) : null,
      createdAt: Number.isFinite(d.createdAt) ? d.createdAt : Date.now(),
    });
  }
  for (const m of movements) if (m.debtId && !debtIds.has(m.debtId)) delete m.debtId;

  const settings = {};
  if (raw.settings && ['auto', 'light', 'dark'].includes(raw.settings.theme)) settings.theme = raw.settings.theme;
  return { categories, movements, debts, settings };
}

/** mode: 'replace' (reemplaza todo) o 'merge' (suma lo que falte). */
export async function importBackup(raw, mode = 'replace') {
  const data = normalizeBackup(raw);
  let added = { movements: 0, debts: 0, categories: 0 };

  if (mode === 'merge') {
    const have = (arr) => new Set(arr.map((x) => x.id));
    const cats = have(state.categories);
    const movs = have(state.movements);
    const debts = have(state.debts);
    for (const c of data.categories) if (!cats.has(c.id)) (state.categories.push({ ...c, order: state.categories.length }), added.categories++);
    for (const d of data.debts) if (!debts.has(d.id)) (state.debts.push(d), added.debts++);
    for (const m of data.movements) if (!movs.has(m.id)) (state.movements.push(m), added.movements++);
  } else {
    state.categories = data.categories.length ? data.categories : DEFAULT_CATS.map((c, i) => ({ ...c, order: i }));
    state.movements = data.movements;
    state.debts = data.debts;
    state.settings = { ...state.settings, ...data.settings, lastCat: {} };
    added = { movements: data.movements.length, debts: data.debts.length, categories: data.categories.length };
  }
  ensureDebtCategory();
  emit();
  await save(() =>
    db.replaceAll({
      categories: state.categories,
      movements: state.movements,
      debts: state.debts,
      meta: [{ key: 'settings', value: state.settings }],
    })
  );
  mirrorTheme();
  return added;
}

/** Borra todo (incluido el PIN) y vuelve a empezar con las categorías de fábrica. */
export async function wipeAll() {
  state.categories = DEFAULT_CATS.map((c, i) => ({ ...c, order: i }));
  state.movements = [];
  state.debts = [];
  state.settings = { ...defaultSettings(), theme: state.settings.theme, seeded: true };
  emit();
  await save(() =>
    db.replaceAll({
      categories: state.categories,
      movements: [],
      debts: [],
      meta: [{ key: 'settings', value: state.settings }],
    })
  );
}
