import { desglosarGastos } from './movements';
import { esColor } from './colors';
import type { Cuenta, Movimiento, Presupuesto } from '../db/types';
import { config } from '../config/neto.config';
import { isISODate } from './dates';

export function mesValido(mes: string) { return /^\d{4}-\d{2}$/.test(mes) && isISODate(`${mes}-01`); }
export function validarPresupuesto(p: Omit<Presupuesto, 'id'>): string | null {
  if (typeof p.mes !== 'string' || !mesValido(p.mes)) return 'Elige un mes válido.';
  if (typeof p.categoriaId !== 'string' || !p.categoriaId.trim()) return 'Elige una categoría de gasto.';
  if (!Number.isSafeInteger(p.limite) || p.limite <= 0) return 'El límite debe ser mayor que 0 y estar expresado en céntimos válidos.';
  if (p.color != null && !esColor(p.color)) return 'El color del presupuesto no es válido.';
  return null;
}
export function gastosPresupuesto(movimientos: Movimiento[], cuentas: Cuenta[], mes: string, hoy: string): Movimiento[] {
  const personales = new Set(cuentas.filter(c => c.ambito === 'personal').map(c => c.id));
  return desglosarGastos(movimientos).filter(m => personales.has(m.cuentaId) && m.fecha.startsWith(`${mes}-`) && m.fecha <= hoy);
}
export function estadoPresupuesto(gastado: number, limite: number) {
  if (gastado < 0) return 'Saldo a favor';
  if (gastado > limite) return 'Superado';
  if (gastado === limite) return 'Límite alcanzado';
  if (gastado / limite * 100 >= config.presupuestos.avisoPorcentaje) return 'Cerca del límite';
  return 'Dentro del límite';
}
export function resumenPresupuestos(presupuestos: Presupuesto[], gastos: Movimiento[]) {
  const categorias = new Set(presupuestos.map(p => p.categoriaId));
  const porCategoria = new Map<string, number>();
  let sinPresupuesto = 0;
  for (const g of gastos) {
    if (!g.categoriaId || !categorias.has(g.categoriaId)) sinPresupuesto += g.importe;
    if (g.categoriaId) porCategoria.set(g.categoriaId, (porCategoria.get(g.categoriaId) ?? 0) + g.importe);
  }
  const filas = presupuestos.map(p => ({ ...p, gastado: porCategoria.get(p.categoriaId) ?? 0 }));
  const limite = presupuestos.reduce((s, p) => s + p.limite, 0);
  const gastado = filas.reduce((s, p) => s + p.gastado, 0);
  return { filas, limite, gastado, restante: limite - gastado, sinPresupuesto };
}
export function seriePresupuesto(gastos: Movimiento[], mes: string, hoy: string) {
  const [y, m] = mes.split('-').map(Number);
  const dias = new Date(y, m, 0).getDate();
  const hasta = mes < hoy.slice(0, 7) ? dias : mes === hoy.slice(0, 7) ? Number(hoy.slice(-2)) : 0;
  const diario = new Map<string, number>();
  for (const g of gastos) if (g.fecha.startsWith(`${mes}-`) && g.fecha <= hoy) diario.set(g.fecha, (diario.get(g.fecha) ?? 0) + g.importe);
  let acumulado = 0;
  const puntos = Array.from({ length: hasta }, (_, i) => {
    const fecha = `${mes}-${String(i + 1).padStart(2, '0')}`;
    acumulado += diario.get(fecha) ?? 0;
    return { fecha, gastado: acumulado };
  });
  return { dias, puntos };
}
