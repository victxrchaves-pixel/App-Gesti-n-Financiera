import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Configuración pensada para Tauri: puerto fijo y sin abrir el navegador.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: { target: ['es2022', 'safari16'], outDir: 'dist' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
