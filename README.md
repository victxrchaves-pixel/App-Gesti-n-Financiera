# Neto

Finanzas personales para cualquier persona, con un **modo autónomo** opcional para facturas, gastos del negocio e impuestos en España.

- App de escritorio para **macOS y Windows** (Tauri + React + TypeScript).
- Los datos se quedan **en tu ordenador** (IndexedDB). Sin cuentas, sin servidores.
- Importes en céntimos enteros y formato español: `1.234,56 €`.

## Estado

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Base, cuentas, movimientos, inicio, ajustes, copia de seguridad, app de escritorio | Hecha, en revisión |
| 2 | Presupuestos, recurrentes y suscripciones, metas | Pendiente |
| 3 | Importar CSV del banco | Pendiente |
| 4a | Modo autónomo: facturas, gastos, «Me pago a mí», inicio del negocio | Pendiente |
| 4b | Modo autónomo: impuestos y exportación para el gestor | Pendiente |
| 5 | Publicación: firma, notarización y página de descarga | Pendiente |

## Instalar una versión de prueba

Cada vez que se sube código, GitHub Actions genera los instaladores:

1. Entra en la pestaña **Actions** del repositorio y abre la última ejecución de «Neto» en verde.
2. Abajo, en **Artifacts**, descarga `Neto-macOS` (un `.dmg`) o `Neto-Windows` (un `.exe`).
3. Descomprime el `.zip` e instala.

Estas versiones **no están firmadas** todavía (eso llega en la Fase 5), así que el sistema avisará:

- **macOS**: arrastra Neto a Aplicaciones y ábrela. Si dice que no se puede abrir, ve a
  *Ajustes del Sistema → Privacidad y seguridad* y pulsa **Abrir igualmente**.
  Si dice que «está dañada», abre Terminal y ejecuta `xattr -cr /Applications/Neto.app`.
- **Windows**: en «Windows protegió tu PC», pulsa **Más información → Ejecutar de todas formas**.

## Desarrollo

Necesitas [Node.js 22](https://nodejs.org) y, para la app de escritorio, [Rust](https://rustup.rs).

```bash
npm install
npm run dev          # la interfaz en el navegador: http://localhost:5173
npm run tauri dev    # la app de escritorio
npm test             # tests
npm run typecheck    # comprobación de tipos
npm run tauri build  # instalador para tu sistema
```

## Organización del código

```
src/
  config/neto.config.ts  Porcentajes, plazos, categorías, colores… todo lo configurable
  lib/                   Lógica pura y con tests: dinero, fechas, saldos, estadísticas, copia
  db/                    Base de datos local (Dexie/IndexedDB), operaciones y datos de ejemplo
  ui/                    Componentes: formularios, gráficos, modales, controles
  screens/               Pantallas: Inicio, Movimientos, Cuentas, Ajustes, bienvenida
  layout/                Barra lateral y estructura
  styles/global.css      Sistema de diseño
src-tauri/               App de escritorio (Rust): ventana, icono, diálogo «Guardar como»
```

Reglas del proyecto:

- Los importes son siempre **céntimos enteros**. Solo `lib/money.ts` convierte a texto y desde texto.
- Nada de valores fiscales ni categorías escritos en el código: van en `src/config/neto.config.ts`.
- Las fechas se guardan como `AAAA-MM-DD` para evitar problemas de zona horaria.
