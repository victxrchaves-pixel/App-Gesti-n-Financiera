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
