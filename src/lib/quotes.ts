import type { Inversion } from '../db/types';
import { config } from '../config/neto.config';
export interface Cotizacion {
  id: string;
  nombre: string;
  simbolo: string;
  tipo: Inversion['tipo'];
  precioEUR: number;
  fecha: string;
  fuente: string;
  historial?: { fecha: string; precioEUR: number }[];
}
export async function cargarCotizaciones(signal?: AbortSignal): Promise<Cotizacion[]> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 12000);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/quotes.json`, {
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error('No se han podido descargar las cotizaciones. Se conservan los últimos precios guardados.');
    const data = await response.json();
    if (!Array.isArray(data.activos)) throw new Error('El servicio de cotizaciones devolvió un formato no válido.');
    const validas = data.activos.filter(
      (q: Cotizacion) =>
        q &&
        typeof q.id === 'string' &&
        typeof q.nombre === 'string' &&
        typeof q.simbolo === 'string' &&
        typeof q.fuente === 'string' &&
        config.inversiones.tipos.some((t) => t.id === q.tipo) &&
        Number.isFinite(q.precioEUR) &&
        q.precioEUR > 0 &&
        typeof q.fecha === 'string' &&
        Number.isFinite(Date.parse(q.fecha)) &&
        Date.parse(q.fecha) <= Date.now() + 300000,
    );
    if (!validas.length)
      throw new Error('No hay cotizaciones válidas disponibles. Puedes introducir una valoración manual.');
    return validas;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted)
      throw new Error(
        'La consulta ha tardado demasiado. Se conservan los precios guardados; puedes volver a intentarlo.',
      );
    if (error instanceof TypeError)
      throw new Error(
        'No se pudo conectar con las cotizaciones. Se conservan los precios guardados; revisa la conexión y vuelve a intentarlo.',
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
export function precioAntiguo(fecha: string) {
  return Date.now() - Date.parse(fecha) > config.inversiones.antiguedadAvisoHoras * 3600000;
}
export function fechaPrecio(fecha: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha.split('-').reverse().join('/');
  return new Date(fecha).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
