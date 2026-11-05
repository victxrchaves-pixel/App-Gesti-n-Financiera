import { SERVICIOS } from './services';
import { config } from '../config/neto.config';
import type { Suscripcion } from '../db/types';
import { isISODate } from './dates';

export function mesesPeriodo(periodo: Suscripcion['periodo']): number {
  return config.suscripciones.periodos.find(p => p.id === periodo)?.meses ?? 1;
}
export function costeMensual(s: Suscripcion): number { return Math.round(s.importe / mesesPeriodo(s.periodo)); }
export function costeAnual(s: Suscripcion): number { return s.importe * (12 / mesesPeriodo(s.periodo)); }
export function siguienteRenovacion(s: Pick<Suscripcion,'proximaFecha'|'periodo'|'diaCobro'>): string {
  const [y, m] = s.proximaFecha.split('-').map(Number);
  const fecha = new Date(y, m - 1 + mesesPeriodo(s.periodo), 1);
  const ultimo = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(Math.min(s.diaCobro, ultimo)).padStart(2, '0')}`;
}
export function validarSuscripcion(s: Omit<Suscripcion, 'id'>): string | null {
  if (s.servicioId != null && !SERVICIOS.some(p => p.id === s.servicioId)) return 'El servicio seleccionado no es válido.';
  if (typeof s.nombre !== 'string' || !s.nombre.trim() || s.nombre.length > 80) return 'Escribe un nombre de hasta 80 caracteres.';
  if (typeof s.categoria !== 'string' || !s.categoria.trim() || s.categoria.length > 60) return 'Escribe una categoría de hasta 60 caracteres.';
  if (!['personal', 'negocio'].includes(s.ambito)) return 'El ámbito no es válido.';
  if (!Number.isSafeInteger(s.importe) || s.importe <= 0 || !Number.isSafeInteger(s.importe * 12)) return 'Introduce un importe positivo válido.';
  if (!config.suscripciones.periodos.some(p => p.id === s.periodo)) return 'La periodicidad no es válida.';
  if (typeof s.proximaFecha !== 'string' || !isISODate(s.proximaFecha)) return 'Elige una fecha de renovación válida.';
  if (!Number.isInteger(s.diaCobro) || s.diaCobro < 1 || s.diaCobro > 31) return 'El día de cobro no es válido.';
  if (!['activa', 'pausada', 'cancelada'].includes(s.estado)) return 'El estado no es válido.';
  if (typeof s.nota !== 'string') return 'La nota no es válida.';
  return null;
}
