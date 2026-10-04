// Estado de navegación compartido entre pantallas (qué pestaña, qué mes, qué filtros).

import { curYM } from './util.js';

export const V = {
  tab: 'resumen', // resumen | movs | deudas | ajustes
  month: curYM(),
  history: { q: '', type: 'todos', categoryId: null, all: false, limit: 150 },
};

// app.js conecta estas funciones al arrancar
export const hooks = {
  render() {},
  go() {},
};

export const render = () => hooks.render();

/** Cambia de pestaña. patch.history permite abrir Movimientos ya filtrado. */
export const go = (tab, patch = {}) => hooks.go(tab, patch);

export function setMonth(ym) {
  V.month = ym;
  V.history.limit = 150;
  render();
}
