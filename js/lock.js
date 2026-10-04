// Bloqueo con PIN de 4 dígitos. Es una barrera de privacidad (por si alguien toma tu teléfono
// con la app abierta); los datos en sí no se cifran en el teléfono.

import { h, fill } from './util.js';
import { state, setSettings, wipeAll } from './store.js';
import { icon, confirmDialog, toast } from './ui.js';

const GRACE_MS = 20000; // tiempo fuera de la app antes de pedir el PIN otra vez
let hiddenAt = 0;
let locked = false;
let failures = 0;
let blockedUntil = 0;

export const hasPin = () => !!(state.settings.pin && state.settings.pin.hash);
export const isLocked = () => locked;

async function hashPin(pin, salt) {
  const text = `${salt}:${pin}`;
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let x = 5381;
  for (const c of text) x = ((x << 5) + x + c.charCodeAt(0)) >>> 0;
  return 'f' + x.toString(16);
}

const randomSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

async function checkPin(pin) {
  const p = state.settings.pin;
  return !!p && (await hashPin(pin, p.salt)) === p.hash;
}

/**
 * Muestra el teclado de PIN. onPin(pin) devuelve:
 *  { ok: true }                      -> cierra
 *  { ok: false, message }            -> sacude y muestra el mensaje
 *  { ok: false, soft: true, title, sub } -> cambia los textos (paso siguiente)
 * Devuelve una promesa: true si terminó bien, false si se canceló.
 */
function showPad({ title, sub = '', cancelable = false, forgot = false, onPin }) {
  return new Promise((resolve) => {
    const root = document.getElementById('lock');
    let digits = '';
    let busy = false;

    const dots = h('div', { class: 'lock-dots', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(() => h('i')));
    const titleEl = h('h2', null, title);
    const subEl = h('div', { class: 'lk-sub', role: 'status' }, sub);
    const renderDots = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < digits.length));

    const finish = (value) => {
      document.removeEventListener('keydown', onKey);
      root.hidden = true;
      root.replaceChildren();
      resolve(value);
    };

    async function submit() {
      busy = true;
      const res = await onPin(digits);
      busy = false;
      if (res.ok) return finish(true);
      digits = '';
      renderDots();
      if (res.soft) {
        titleEl.textContent = res.title;
        subEl.textContent = res.sub || '';
        return;
      }
      subEl.textContent = res.message || 'PIN incorrecto';
      dots.classList.remove('shake');
      void dots.offsetWidth;
      dots.classList.add('shake');
    }

    function press(k) {
      if (busy) return;
      if (k === 'back') digits = digits.slice(0, -1);
      else if (digits.length < 4) digits += k;
      renderDots();
      if (digits.length === 4) setTimeout(submit, 110);
    }

    const keyBtn = (k) => h('button', { type: 'button', class: 'key', 'aria-label': k === 'back' ? 'Borrar' : k, onClick: () => press(k) }, k === 'back' ? icon('backspace') : k);
    const bottomLeft = cancelable ? h('button', { type: 'button', class: 'key ghost', style: { fontSize: '16px', fontWeight: 500 }, onClick: () => finish(false) }, 'Cancelar') : h('span');
    const keys = h('div', { class: 'lock-keys' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(keyBtn), bottomLeft, keyBtn('0'), keyBtn('back'));

    const forgotBtn = forgot
      ? h(
          'button',
          {
            type: 'button',
            class: 'lk-forgot',
            onClick: async () => {
              const ok = await confirmDialog({
                title: '¿Olvidaste tu PIN?',
                message: 'Para entrar sin PIN hay que borrar todos los datos de la app. Si tienes un respaldo, podrás importarlo después.',
                confirmText: 'Borrar todo',
                destructive: true,
              });
              if (!ok) return;
              await wipeAll();
              toast('Se borraron los datos y el PIN');
              finish(true);
            },
          },
          '¿Olvidaste tu PIN?'
        )
      : null;

    function onKey(e) {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape' && cancelable) finish(false);
    }
    document.addEventListener('keydown', onKey);

    fill(root, h('div', { class: 'lk-icon' }, icon('lock')), titleEl, subEl, dots, keys, forgotBtn);
    root.hidden = false;
  });
}

/** Pide el PIN para entrar. Si no hay PIN, no hace nada. */
export async function unlock() {
  if (!hasPin()) {
    locked = false;
    document.body.classList.remove('cover');
    return;
  }
  locked = true;
  await showPad({
    title: 'Ingresa tu PIN',
    forgot: true,
    onPin: async (pin) => {
      if (Date.now() < blockedUntil) return { ok: false, message: `Demasiados intentos. Espera ${Math.ceil((blockedUntil - Date.now()) / 1000)} s.` };
      if (await checkPin(pin)) {
        failures = 0;
        return { ok: true };
      }
      failures++;
      if (failures >= 5) {
        blockedUntil = Date.now() + 30000;
        failures = 0;
        return { ok: false, message: 'Demasiados intentos. Espera 30 s.' };
      }
      return { ok: false, message: 'PIN incorrecto' };
    },
  });
  locked = false;
  document.body.classList.remove('cover');
}

/** Pide el PIN actual para confirmar una acción (cambiar o quitar el PIN). */
export function verifyPin(title = 'Confirma tu PIN') {
  return showPad({ title, cancelable: true, onPin: async (pin) => ((await checkPin(pin)) ? { ok: true } : { ok: false, message: 'PIN incorrecto' }) });
}

/** Crea un PIN nuevo (lo pide dos veces). Devuelve true si quedó guardado. */
export async function createPin() {
  let first = null;
  let result = null;
  const done = await showPad({
    title: 'Crea un PIN',
    sub: 'Elige 4 dígitos',
    cancelable: true,
    onPin: async (pin) => {
      if (first === null) {
        first = pin;
        return { ok: false, soft: true, title: 'Confírmalo', sub: 'Escríbelo otra vez' };
      }
      if (pin !== first) {
        first = null;
        return { ok: false, soft: true, title: 'Crea un PIN', sub: 'No coincidían. Intenta de nuevo' };
      }
      result = pin;
      return { ok: true };
    },
  });
  if (!done || !result) return false;
  const salt = randomSalt();
  await setSettings({ pin: { salt, hash: await hashPin(result, salt) } });
  return true;
}

export async function removePin() {
  await setSettings({ pin: null });
}

/** Tapa la pantalla cuando la app pasa a segundo plano y pide el PIN al volver si pasó un rato. */
export function initAutoLock() {
  document.addEventListener('visibilitychange', () => {
    if (!hasPin()) return;
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      document.body.classList.add('cover');
    } else {
      if (!locked && Date.now() - hiddenAt > GRACE_MS) unlock();
      else if (!locked) document.body.classList.remove('cover');
    }
  });
}
