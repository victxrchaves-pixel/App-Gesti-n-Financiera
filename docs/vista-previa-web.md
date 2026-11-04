# Vista previa web de Neto

La interfaz se puede alojar en GitHub Pages. Las cuentas y movimientos se guardan
en IndexedDB en el navegador de cada visitante; el despliegue contiene únicamente
la aplicación compilada. Los datos de ejemplo solo se añaden al pulsar «Cargar ejemplo».

## Activación inicial

1. Comprobar que el repositorio admite GitHub Pages y que no hay un sitio existente
   que deba conservarse. Si ya lo hay, acordar otro destino antes de desplegar.
2. En Settings → Pages del repositorio, elegir GitHub Actions como origen.
3. Subir el código revisado a la rama `codex/neto-web-preview`. El workflow
   `Neto · vista previa web` ejecuta los tests, comprueba los tipos, compila y despliega.
4. Abrir el enlace que devuelve el paso de despliegue cuando termine correctamente.
   No dar una URL por activa hasta comprobarla desde el navegador.

Si el entorno `github-pages` tiene restricciones de ramas, permitir
`codex/neto-web-preview` para ese despliegue. No desactivar revisiones obligatorias.

## Cada cambio

Hacer commit y push de los cambios a `codex/neto-web-preview`. GitHub Actions
actualizará el mismo enlace tras completar el despliegue. Recargar la página para
ver la nueva versión; la web alojada no recibe las ediciones locales al instante.
Si los tests o la compilación fallan, la versión publicada anterior permanece.

La compilación usa `/App-Gesti-n-Financiera/` como base de los recursos, y el router
actual con `#` permite navegar entre pantallas sin reglas de redirección adicionales.
La configuración de escritorio Tauri y el servidor de desarrollo conservan su base.

## Comprobaciones locales

```bash
export PATH=/workspace/.tooling/node22/bin:$PATH
cd /workspace/App-Gesti-n-Financiera
npm test
npm run build -- --base /App-Gesti-n-Financiera/
```

## Suscripciones e inversión

La base de datos v2 conserva cuentas y movimientos v1 y añade suscripciones,
posiciones de inversión e histórico diario de cartera. Las copias v2 incluyen
las tres tablas nuevas; se siguen admitiendo las copias v1.

Las suscripciones personales y de negocio se muestran por separado. Avanzar una
renovación solo cambia su fecha; no realiza pagos ni genera movimientos contables.
Los importes mensual/anual son equivalencias de las cuotas activas.

Las posiciones y cantidades se quedan en IndexedDB. La web descarga únicamente
un catálogo público común (`data/quotes.json`), sin enviar posiciones a proveedores.
Los activos del catálogo usan CoinGecko, Frankfurter/BCE y Yahoo Finance. Los
precios de acciones se convierten con el último cambio del BCE; para el histórico
se usa el cambio de cada fecha (o el último día hábil anterior). Los activos que
no están en el catálogo admiten precio manual en euros.

`python3 scripts/update-quotes.py` genera el catálogo al desplegar. Si una fuente
falla, conserva el precio anterior y su fecha original; no marca precios antiguos
como nuevos. La app indica la fuente y fecha de cada valoración, y avisa tras 48 h.
La serie de mercado es independiente del historial de la cartera: este último
registra las posiciones desde el alta, tomando la última valoración de cada día,
y puede cambiar por aportaciones, cambios de cantidad o bajas. No es una medida
de rentabilidad ajustada por flujos.

El workflow `refresh-quotes.yml` debe existir también en la rama predeterminada
para que GitHub ejecute su programación. Cada seis horas hace checkout de
`codex/neto-web-preview`, consulta precios, verifica y recompila la web, y publica
el mismo enlace. GitHub puede retrasar o desactivar ejecuciones programadas según
sus límites y la actividad del repositorio; las fechas visibles permiten detectarlo.
La publicación periódica no modifica las posiciones guardadas en cada navegador:
se actualizan al abrir Inversión o pulsar Actualizar precios. La siguiente visita
añade una valoración al histórico local; no se inventan valoraciones para los días
que no se abrió la app.
