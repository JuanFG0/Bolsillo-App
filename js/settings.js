// Pantalla de Ajustes: tema, categorías, respaldo, PIN y conceptos básicos.

import { h } from './util.js';
import { state, setSettings, wipeAll } from './store.js';
import { row, switchEl, segmented, confirmDialog, toast } from './ui.js';
import { openCategoriesSheet, openGlossarySheet } from './forms.js';
import { exportBackup, importBackupFlow, lastBackupText } from './backup.js';
import { hasPin, createPin, verifyPin, removePin } from './lock.js';
import { applyTheme } from './theme.js';
import { render } from './nav.js';
import { storageVolatile } from './store.js';

export const APP_VERSION = '1.1.1';

// Filas de Ajustes: el texto secundario puede ocupar varias líneas
const R = (o) => row({ wrap: true, ...o });

const head = (t) => h('div', { class: 'dayhead', style: { paddingTop: '26px' } }, h('span', null, t));

export function settingsView() {
  const page = h('div', { class: 'page' }, h('h1', { class: 'h-large' }, 'Ajustes'));

  // Apariencia
  const themeSeg = segmented(
    [
      { value: 'auto', label: 'Automático' },
      { value: 'light', label: 'Claro' },
      { value: 'dark', label: 'Oscuro' },
    ],
    state.settings.theme,
    async (v) => {
      await setSettings({ theme: v });
      applyTheme();
    }
  );
  page.append(head('Apariencia'), h('div', { class: 'group' }, h('div', { class: 'field-block' }, themeSeg)));

  // Datos
  page.append(head('Tus datos'), h('div', { class: 'group' }, R({ ico: 'tag', title: 'Categorías', sub: `${state.categories.length} en total`, chevron: true, onClick: openCategoriesSheet })));

  // Respaldo
  const reminder = switchEl(state.settings.reminder, (on) => setSettings({ reminder: on }), 'Recordarme respaldar');
  page.append(
    head('Respaldo'),
    h(
      'div',
      { class: 'group' },
      R({ ico: 'shield', title: 'Último respaldo', right: lastBackupText(), rightClass: 'muted' }),
      R({ ico: 'share', title: 'Exportar respaldo', sub: 'Guárdalo en Archivos o iCloud Drive', chevron: true, onClick: exportBackup }),
      R({ ico: 'import', title: 'Importar respaldo', sub: 'Recupera tus datos desde un archivo', chevron: true, onClick: importBackupFlow }),
      R({ ico: 'info', title: 'Recordarme respaldar', sub: 'Un aviso en el resumen cada 2 semanas', right: reminder })
    ),
    h('p', { class: 'note' }, 'Tus datos viven solo en este teléfono. Si borras la app o cambias de iPhone, importa tu último respaldo y recuperas todo.')
  );

  // Seguridad
  const pinSwitch = switchEl(
    hasPin(),
    async (on) => {
      const input = pinSwitch.querySelector('input');
      if (on) {
        if (await createPin()) toast('PIN activado');
        else input.checked = false;
      } else if (await verifyPin('Ingresa tu PIN')) {
        await removePin();
        toast('PIN desactivado');
      } else input.checked = true;
      render();
    },
    'Bloqueo con PIN'
  );
  const secRows = [R({ ico: 'lock', title: 'Bloqueo con PIN', sub: 'Se pide al abrir la app', right: pinSwitch })];
  if (hasPin()) {
    secRows.push(
      R({
        ico: 'lock',
        title: 'Cambiar PIN',
        chevron: true,
        onClick: async () => {
          if (await verifyPin('Ingresa tu PIN actual')) {
            if (await createPin()) toast('PIN cambiado');
          }
        },
      })
    );
  }
  page.append(head('Seguridad'), h('div', { class: 'group' }, secRows), h('p', { class: 'note' }, 'El PIN evita que otra persona abra la app en tu teléfono. No cifra los datos guardados.'));

  // Aprender
  page.append(head('Aprende'), h('div', { class: 'group' }, R({ ico: 'book', title: 'Conceptos básicos', sub: 'Qué significa cada cosa', chevron: true, onClick: openGlossarySheet })));

  // Almacenamiento
  const p = state.persisted;
  page.append(
    head('Almacenamiento'),
    h(
      'div',
      { class: 'group' },
      R({
        ico: 'shield',
        title: 'Almacenamiento protegido',
        sub: storageVolatile() ? 'No disponible: tus datos no se están guardando' : p === false ? 'El teléfono podría borrarlos si necesita espacio. Haz respaldos.' : 'El teléfono no los borra por falta de espacio',
        right: storageVolatile() ? 'No' : p === true ? 'Sí' : '—',
        rightClass: 'muted',
      })
    )
  );

  // Avanzado
  page.append(
    head('Avanzado'),
    h(
      'div',
      { class: 'group' },
      R({
        ico: 'trash',
        title: 'Borrar todos los datos',
        danger: true,
        onClick: async () => {
          const ok = await confirmDialog({ title: '¿Borrar todo?', message: 'Se eliminan movimientos, deudas, categorías propias y el PIN. Esto no se puede deshacer.', confirmText: 'Continuar', destructive: true });
          if (!ok) return;
          const sure = await confirmDialog({ title: 'Última confirmación', message: '¿Seguro? Si no tienes un respaldo, perderás todo.', confirmText: 'Borrar todo', destructive: true });
          if (!sure) return;
          await wipeAll();
          toast('Todo se borró');
        },
      })
    ),
    h('p', { class: 'note', style: { textAlign: 'center', marginTop: '28px' } }, `Bolsillo ${APP_VERSION} · Funciona sin internet`)
  );
  return page;
}
