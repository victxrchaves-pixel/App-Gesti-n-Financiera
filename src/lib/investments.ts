import { config } from '../config/neto.config';
import type { Inversion } from '../db/types';

export function valorInversion(i: Pick<Inversion, 'cantidad' | 'precioEUR'>): number {
  const euros = i.cantidad * i.precioEUR;
  const total = Math.round((euros + Number.EPSILON * euros) * 100);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('La valoración supera el importe permitido.');
  return total;
}
/** Unidades/precios: decimales sin separadores de miles, hasta 12 decimales. */
export function parseDecimal(texto: string): number | null {
  const s = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,12})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER ? n : null;
}
export function validarInversion(i: Omit<Inversion, 'id'>): string | null {
  if (typeof i.nombre !== 'string' || !i.nombre.trim() || i.nombre.length > 80)
    return 'Escribe un nombre de hasta 80 caracteres.';
  if (!config.inversiones.tipos.some((t) => t.id === i.tipo)) return 'El tipo de inversión no es válido.';
  if (!Number.isFinite(i.cantidad) || i.cantidad < 1e-12 || i.cantidad > Number.MAX_SAFE_INTEGER)
    return 'Introduce una cantidad mayor que cero.';
  if (!Number.isSafeInteger(i.coste) || i.coste < 0) return 'Introduce un coste de compra válido en euros.';
  if (!Number.isFinite(i.precioEUR) || i.precioEUR < 0 || i.precioEUR > Number.MAX_SAFE_INTEGER)
    return 'Introduce un precio por unidad válido.';
  if (i.activoId !== null && (typeof i.activoId !== 'string' || !i.activoId)) return 'El activo no es válido.';
  if (typeof i.precioFecha !== 'string' || !Number.isFinite(Date.parse(i.precioFecha)))
    return 'La fecha del precio no es válida.';
  if (typeof i.fuente !== 'string' || typeof i.nota !== 'string') return 'Los datos de la inversión no son válidos.';
  try {
    valorInversion(i);
  } catch {
    return 'La valoración supera el importe permitido.';
  }
  return null;
}
