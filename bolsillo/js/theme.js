// Tema claro/oscuro: "auto" sigue al iPhone.

import { state } from './store.js';

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveTheme(theme = state.settings.theme) {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return mq && mq.matches ? 'dark' : 'light';
}

export function applyTheme() {
  const t = resolveTheme();
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.getElementById('theme-color');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#000000' : '#F2F2F7');
}

export function watchTheme() {
  if (mq && mq.addEventListener) mq.addEventListener('change', () => state.settings.theme === 'auto' && applyTheme());
}
