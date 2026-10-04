// Exportar e importar respaldos (archivo JSON). Es lo que protege tus datos si cambias de teléfono.

import { h, todayStr } from './util.js';
import { exportData, markBackedUp, normalizeBackup, importBackup, backupStatus } from './store.js';
import { toast, chooseDialog, confirmDialog } from './ui.js';

export function lastBackupText() {
  const { last, days } = backupStatus();
  if (!last) return 'Nunca';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

/** En iPhone abre la hoja de compartir para guardar en Archivos / iCloud Drive. */
export async function exportBackup() {
  const json = JSON.stringify(exportData(), null, 2);
  const name = `bolsillo-respaldo-${todayStr()}.json`;
  let file = null;
  try {
    file = new File([json], name, { type: 'application/json' });
  } catch (e) {}

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Respaldo de Bolsillo' });
      await markBackedUp();
      toast('Respaldo guardado');
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false; // la persona canceló
    }
  }

  // Alternativa: descarga directa (computador)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  await markBackedUp();
  toast('Respaldo descargado');
  return true;
}

export function importBackupFlow() {
  const input = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    input.remove();
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const data = normalizeBackup(raw);
      const mode = await chooseDialog({
        title: 'Importar respaldo',
        message: `El archivo trae ${data.movements.length} movimientos, ${data.debts.length} deudas y ${data.categories.length} categorías.`,
        options: [
          { label: 'Combinar con lo que tengo', value: 'merge', strong: true },
          { label: 'Reemplazar todo lo que tengo', value: 'replace', destructive: true },
        ],
      });
      if (!mode) return;
      if (mode === 'replace') {
        const ok = await confirmDialog({ title: '¿Reemplazar todo?', message: 'Lo que tienes ahora en la app se borra y queda lo del archivo.', confirmText: 'Reemplazar', destructive: true });
        if (!ok) return;
      }
      const added = await importBackup(raw, mode);
      toast(mode === 'merge' ? `Se sumaron ${added.movements} movimientos` : 'Respaldo restaurado');
    } catch (e) {
      toast(e instanceof SyntaxError ? 'El archivo no se pudo leer' : e.message || 'No se pudo importar');
    }
  });
  input.click();
}
