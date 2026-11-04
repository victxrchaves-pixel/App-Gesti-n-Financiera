/** Diferencias entre la app de escritorio (Tauri) y el navegador. */

export function esEscritorio(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function esMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);
}

export interface OpcionesGuardar {
  /** Texto del filtro del diálogo, p. ej. "Copia de Neto". */
  descripcion: string;
  /** Extensión sin punto, p. ej. "json" o "csv". */
  extension: string;
  tipoMime: string;
}

/**
 * Guarda un archivo de texto. En el escritorio abre el diálogo "Guardar como" del sistema;
 * en el navegador lo descarga. Devuelve false si la persona cancela.
 */
export async function guardarArchivo(nombre: string, contenido: string, opciones: OpcionesGuardar): Promise<boolean> {
  if (esEscritorio()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<boolean>('guardar_archivo', {
      nombre,
      contenido,
      descripcion: opciones.descripcion,
      extension: opciones.extension,
    });
  }
  const blob = new Blob([contenido], { type: opciones.tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
