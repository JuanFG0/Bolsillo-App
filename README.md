# Bolsillo

App de finanzas personales para tu iPhone. Funciona sin internet y todo lo que anotas se guarda **solo en tu teléfono** (la app no envía nada a ningún servidor).

## Qué incluye

- **Resumen del mes:** ingresos, gastos y cuánto te queda, a dónde se fue cada peso (dona por categoría), regla 50/30/20 y gráfico de los últimos 6 meses.
- **Botón + para agregar** gastos e ingresos (monto, categoría, fecha y nota).
- **Categorías** predefinidas que puedes crear, editar y borrar (Ajustes → Categorías).
- **Movimientos:** historial con búsqueda y filtros (tipo, categoría, mes o todo el historial). Toca uno para editarlo o eliminarlo.
- **Deudas:** cuánto debes, cuánto llevas pagado, cuota, día de pago y aviso de vencimiento. Los pagos también cuentan como gasto.
- **Respaldo:** exportar e importar tus datos en un archivo.
- **Bloqueo con PIN**, modo claro/oscuro, y un aviso para recordarte hacer respaldos.

## Instalarla en el iPhone

1. Abre el link **en Safari** (con internet).
2. Toca el botón **Compartir** (cuadrado con flecha hacia arriba) → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre Bolsillo desde el ícono nuevo. La primera vez deja que cargue completa.
4. Para comprobar que funciona sin internet: activa el modo avión y ábrela de nuevo.

Úsala siempre desde el ícono de la pantalla de inicio (no desde Safari), así iOS la trata como una app y protege mejor sus datos.

## Cuida tus datos

- Los datos viven en el almacenamiento de la app dentro del iPhone. **Si borras el ícono de Bolsillo o limpias los datos de sitios web de Safari, se pierden.**
- Haz un respaldo cada tanto: **Ajustes → Exportar respaldo → Guardar en Archivos** (mejor en iCloud Drive). La app te lo recuerda.
- Si cambias de teléfono o algo sale mal: instala la app de nuevo y usa **Ajustes → Importar respaldo**.
- El PIN evita que otra persona abra la app, pero **no cifra** los datos. Si lo olvidas, la única salida es borrar los datos (y luego importar tu respaldo).


## Estructura de archivos

```
index.html            Página principal
manifest.webmanifest  Datos para instalarla como app
sw.js                 Hace que funcione sin internet (aquí se sube la VERSION)
css/styles.css        Diseño
js/                   Lógica: store.js (datos), views.js (pantallas), forms.js (formularios) y más
icons/                Íconos de la app
```
