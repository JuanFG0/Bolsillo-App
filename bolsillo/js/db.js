// Capa mínima sobre IndexedDB. Todo queda guardado en el propio teléfono.
// Si el navegador no permite IndexedDB (modo privado, por ejemplo), la app
// funciona igual pero avisa que los datos no se van a conservar (volatile).

const NAME = 'bolsillo-db';
const STORES = ['movements', 'categories', 'debts', 'meta'];
const KEYS = { movements: 'id', categories: 'id', debts: 'id', meta: 'key' };

let db = null;
let volatile = false;

export const isVolatile = () => volatile;

export function openDB() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      volatile = true;
      return resolve(null);
    }
    let req;
    try {
      req = indexedDB.open(NAME, 1);
    } catch (e) {
      volatile = true;
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const st of STORES) {
        if (!d.objectStoreNames.contains(st)) d.createObjectStore(st, { keyPath: KEYS[st] });
      }
    };
    req.onsuccess = () => {
      db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = req.onblocked = () => {
      volatile = true;
      resolve(null);
    };
  });
}

const done = (t) =>
  new Promise((ok, ko) => {
    t.oncomplete = () => ok();
    t.onerror = () => ko(t.error);
    t.onabort = () => ko(t.error || new Error('Transacción cancelada'));
  });

const request = (r) =>
  new Promise((ok, ko) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });

export async function getAll(store) {
  if (!db) return [];
  return request(db.transaction(store).objectStore(store).getAll());
}

export async function put(store, value) {
  if (!db) return;
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).put(value);
  return done(t);
}

export async function putMany(store, values) {
  if (!db || !values.length) return;
  const t = db.transaction(store, 'readwrite');
  const os = t.objectStore(store);
  for (const v of values) os.put(v);
  return done(t);
}

export async function remove(store, id) {
  if (!db) return;
  const t = db.transaction(store, 'readwrite');
  t.objectStore(store).delete(id);
  return done(t);
}

/** Reemplaza todo el contenido en una sola transacción (todo o nada). */
export async function replaceAll({ categories = [], movements = [], debts = [], meta = [] }) {
  if (!db) return;
  const t = db.transaction(STORES, 'readwrite');
  const data = { categories, movements, debts, meta };
  for (const st of STORES) {
    const os = t.objectStore(st);
    os.clear();
    for (const v of data[st]) os.put(v);
  }
  return done(t);
}
