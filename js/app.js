// Arranque de Bolsillo: carga los datos, dibuja la pantalla y maneja la animación de apertura.

import * as store from './store.js';
import { h, curYM } from './util.js';
import { icon, toast, trackViewport } from './ui.js';
import { V, hooks } from './nav.js';
import { dashboardView, historyView, debtsView, navBar, debtsNavActions } from './views.js';
import { settingsView } from './settings.js';
import { openMovementSheet } from './forms.js';
import { applyTheme, watchTheme } from './theme.js';
import { unlock, initAutoLock } from './lock.js';

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: 'pie' },
  { id: 'movs', label: 'Movimientos', icon: 'list' },
  { id: 'deudas', label: 'Deudas', icon: 'card' },
  { id: 'ajustes', label: 'Ajustes', icon: 'sliders' },
];
const TITLES = { resumen: 'Resumen', movs: 'Movimientos', deudas: 'Deudas', ajustes: 'Ajustes' };

const viewEl = document.getElementById('view');
const scrollPos = {};
let renderedTab = null;
let knownMonth = curYM();

function buildDock() {
  const tabs = h(
    'nav',
    { class: 'tabs', 'aria-label': 'Secciones' },
    // Pastilla de vidrio que se desliza hasta la pestaña activa
    h('span', { class: 'tab-pill no-anim', 'aria-hidden': 'true' }),
    TABS.map((t) =>
      h(
        'button',
        {
          type: 'button',
          class: 'tab',
          'data-tab': t.id,
          onClick: () => {
            if (V.tab === t.id) viewEl.scrollTo({ top: 0, behavior: 'smooth' });
            else hooks.go(t.id);
          },
        },
        icon(t.icon),
        h('span', null, t.label)
      )
    )
  );
  const fab = h('button', { type: 'button', class: 'fab', 'aria-label': 'Agregar movimiento', onClick: () => openMovementSheet(null, {}) }, icon('plus'));
  document.getElementById('dock').replaceChildren(tabs, fab);
  initTabDrag(tabs);
}

function movePill() {
  const pill = document.querySelector('.tab-pill');
  const active = document.querySelector('.tab[aria-current="page"]');
  if (!pill || !active) return;
  pill.style.width = active.offsetWidth + 'px';
  pill.style.transform = `translateX(${active.offsetLeft}px)`;
  // la primera vez se coloca sin animación
  if (pill.classList.contains('no-anim')) requestAnimationFrame(() => requestAnimationFrame(() => pill.classList.remove('no-anim')));
}

// Arrastrar el dedo por la barra (como Apple Music): la pastilla sigue el dedo y al soltar abre la pestaña que quedó debajo.
function initTabDrag(bar) {
  const pill = bar.querySelector('.tab-pill');
  let drag = null;
  let justDragged = false;

  const tabAt = (x) => {
    const tabs = [...bar.querySelectorAll('.tab')];
    const r = bar.getBoundingClientRect();
    // ancho disponible sin el relleno de la barra; se elige la pestaña más cercana al dedo
    const px = Math.min(Math.max(x, r.left + 6), r.right - 6);
    return tabs.find((t) => { const b = t.getBoundingClientRect(); return px >= b.left && px <= b.right; }) || tabs[tabs.length - 1];
  };
  const follow = (x) => {
    const r = bar.getBoundingClientRect();
    const hot = tabAt(x);
    drag.hot = hot;
    bar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('hot', t === hot));
    const w = hot.offsetWidth;
    const left = Math.min(Math.max(x - r.left - w / 2, 5), bar.clientWidth - 5 - w);
    pill.style.width = w + 'px';
    pill.style.transform = `translateX(${left}px)`;
  };
  const end = (commit) => {
    if (!drag) return;
    const hot = drag.hot;
    const wasDragging = drag.active;
    drag = null;
    bar.classList.remove('pressing', 'dragging');
    bar.querySelectorAll('.tab').forEach((t) => t.classList.remove('hot'));
    if (!wasDragging) return;
    justDragged = true;
    setTimeout(() => (justDragged = false), 60);
    if (commit && hot && hot.dataset.tab !== V.tab) hooks.go(hot.dataset.tab);
    else movePill();
  };

  bar.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button > 0) return;
    drag = { id: e.pointerId, x0: e.clientX, active: false, hot: null };
    bar.classList.add('pressing');
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.x0) < 8) return;
      drag.active = true;
      bar.classList.add('dragging');
      try { bar.setPointerCapture(e.pointerId); } catch (_) {}
    }
    follow(e.clientX);
  });
  bar.addEventListener('pointerup', () => end(true));
  bar.addEventListener('pointercancel', () => end(false));
  bar.addEventListener('lostpointercapture', () => drag && drag.active && end(true));
  // si hubo arrastre, el "clic" que sigue al soltar no debe abrir otra pestaña
  bar.addEventListener('click', (e) => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
}

function updateDock() {
  document.querySelectorAll('.tab').forEach((b) => (b.dataset.tab === V.tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  movePill();
}
window.addEventListener('resize', movePill);

function renderView() {
  const tab = V.tab;
  const keep = renderedTab === tab ? viewEl.scrollTop : scrollPos[tab] || 0;
  const nav = navBar(TITLES[tab], tab === 'deudas' ? debtsNavActions() : []);
  const builders = { resumen: dashboardView, movs: historyView, deudas: debtsView, ajustes: settingsView };
  const page = builders[tab]();
  if (renderedTab !== tab) page.classList.add('enter');
  viewEl.replaceChildren(nav, page);
  viewEl.scrollTop = keep;
  viewEl.classList.toggle('scrolled', keep > 28);
  renderedTab = tab;
  updateDock();
}

hooks.render = renderView;
hooks.go = (tab, patch = {}) => {
  scrollPos[V.tab] = viewEl.scrollTop;
  V.tab = tab;
  if (patch.history) {
    Object.assign(V.history, { limit: 150 }, patch.history);
    scrollPos[tab] = 0;
  }
  renderView();
};

viewEl.addEventListener('scroll', () => viewEl.classList.toggle('scrolled', viewEl.scrollTop > 28), { passive: true });

// Si la app queda abierta y cambia el mes, pasa al mes nuevo
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = curYM();
  if (now !== knownMonth) {
    if (V.month === knownMonth) V.month = now;
    knownMonth = now;
    renderView();
  }
});

function registerServiceWorker() {
  const ok = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!('serviceWorker' in navigator) || !ok) return;
  const register = () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Sin modo offline:', e));
  // La app arranca de forma asíncrona: si la página ya terminó de cargar, el evento "load" ya pasó.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}

async function boot() {
  const t0 = performance.now();
  trackViewport();
  store.setErrorHandler((msg) => toast(msg, { ms: 5000 }));
  await store.init();
  applyTheme();
  watchTheme();
  buildDock();
  renderView();
  store.subscribe(renderView);
  store.checkPersisted();
  initAutoLock();
  registerServiceWorker();

  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minShow = reduced ? 500 : 2000;
  const wait = Math.max(0, minShow - (performance.now() - t0));
  await new Promise((r) => setTimeout(r, wait));

  // Si hay PIN, el bloqueo queda por encima antes de que se vaya la animación
  unlock();
  const splash = document.getElementById('splash');
  splash.classList.add('out');
  setTimeout(() => splash.remove(), 800);
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('splash')?.remove();
  document.body.appendChild(h('div', { style: { padding: '40px 24px', font: '16px/1.4 system-ui' } }, h('h2', null, 'No se pudo abrir Bolsillo'), h('p', null, String(err && err.message ? err.message : err))));
});
