// Service worker de Bolsillo: guarda la app en el teléfono para que abra sin internet.
// IMPORTANTE: cuando cambies cualquier archivo de la app, sube el número de VERSION
// para que los teléfonos descarguen la versión nueva (se aplica la siguiente vez que abras la app).

const VERSION = 'bolsillo-v1.0.0';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/backup.js',
  'js/charts.js',
  'js/db.js',
  'js/forms.js',
  'js/lock.js',
  'js/nav.js',
  'js/settings.js',
  'js/store.js',
  'js/theme.js',
  'js/ui.js',
  'js/util.js',
  'js/views.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
