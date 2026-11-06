import { config } from '../config/neto.config';

/**
 * Las fechas se guardan como texto "AAAA-MM-DD" (día local) y los meses como "AAAA-MM".
 * Así no hay sorpresas con zonas horarias.
 */

export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Los `n` meses que terminan en `endKey`, de más antiguo a más reciente. */
export function lastMonths(endKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(endKey, i - (n - 1)));
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = partes(iso);
  return toISODate(new Date(y, m - 1, d + n));
}

export function monthLabel(key: string, conAnio = true): string {
  const [y, m] = key.split('-').map(Number);
  return conAnio ? `${MESES[m - 1]} de ${y}` : MESES[m - 1];
}

export function monthShortLabel(key: string): string {
  const [, m] = key.split('-').map(Number);
  return MESES_CORTOS[m - 1];
}

/** "miércoles, 4 de noviembre" */
export function longDate(iso: string, conAnio = false): string {
  const [y, m, d] = partes(iso);
  const dia = DIAS[new Date(y, m - 1, d).getDay()];
  return `${dia}, ${d} de ${MESES[m - 1]}${conAnio ? ` de ${y}` : ''}`;
}

/** "4 nov" o "4 nov 2025" si no es del año de `hoy`. */
export function shortDate(iso: string, hoy: string = todayISO()): string {
  const [y, m, d] = partes(iso);
  const [yh] = partes(hoy);
  return `${d} ${MESES_CORTOS[m - 1]}${y !== yh ? ` ${y}` : ''}`;
}

/** Cabecera de un día en la lista de movimientos. */
export function dayHeader(iso: string, hoy: string = todayISO()): string {
  if (iso === hoy) return 'Hoy';
  if (iso === addDays(hoy, -1)) return 'Ayer';
  const [y] = partes(iso);
  const [yh] = partes(hoy);
  const t = longDate(iso, y !== yh);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function greeting(hora: number): string {
  let texto: string = config.saludos[0].texto;
  for (const tramo of config.saludos) if (hora >= tramo.desde) texto = tramo.texto;
  return texto;
}
