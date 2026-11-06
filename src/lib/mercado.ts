import { addDays } from './dates';

/** Un punto del historial de mercado: precio de una unidad en euros ese día. */
export interface PuntoMercado {
  fecha: string;
  precioEUR: number;
}

/** Puntos del historial desde hace `dias` días hasta hoy (incluidos), en orden de fecha. */
export function historialEnRango(historial: PuntoMercado[], dias: number, hoy: string): PuntoMercado[] {
  const desde = addDays(hoy, -dias);
  return historial
    .filter((p) => Number.isFinite(p.precioEUR) && p.precioEUR > 0)
    .filter((p) => p.fecha.slice(0, 10) >= desde && p.fecha.slice(0, 10) <= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Cuánto ha cambiado el precio entre el primer y el último punto. Null si hay menos de dos. */
export function variacion(puntos: PuntoMercado[]) {
  if (puntos.length < 2) return null;
  const inicio = puntos[0].precioEUR;
  const fin = puntos[puntos.length - 1].precioEUR;
  return { inicio, fin, cambio: fin - inicio, pct: ((fin - inicio) / inicio) * 100 };
}

/** Si el historial empieza después del inicio del periodo, la fecha del primer dato (para avisarlo). */
export function datosDesde(puntos: PuntoMercado[], dias: number, hoy: string): string | null {
  if (!puntos.length) return null;
  const primero = puntos[0].fecha.slice(0, 10);
  // Un margen de 4 días cubre fines de semana y festivos sin cotización.
  return primero > addDays(hoy, -dias + 4) ? primero : null;
}

/** Precio medio al que se compró cada unidad, en euros. Null si no hay coste o cantidad. */
export function precioMedioCompra(i: { coste: number; cantidad: number }): number | null {
  return i.coste > 0 && i.cantidad > 0 ? i.coste / 100 / i.cantidad : null;
}

/** «+4,25 %» o «−1,3 %», con signo siempre. */
export function formatPct(pct: number): string {
  const t = Math.abs(pct).toLocaleString('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  return `${pct >= 0 ? '+' : '−'}${t} %`;
}
