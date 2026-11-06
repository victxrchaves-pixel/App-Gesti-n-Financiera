import { config } from '../config/neto.config';
import type { Categoria, Cuenta, Movimiento } from '../db/types';
import { addMonths, monthKey } from './dates';
import { iconoCategoria } from './iconos';
import { serieMensual } from './stats';

/**
 * Presupuesto por porcentajes: a partir de lo que ingresas al mes, reparte un límite para
 * cada categoría de gasto. Lo que no se reparte queda para ahorrar.
 */

export type Plantilla = (typeof config.presupuestos.plantillas)[number];

export function plantillaPorId(id: string): Plantilla {
  return config.presupuestos.plantillas.find((p) => p.id === id) ?? config.presupuestos.plantillas[0];
}

/** Porcentaje inicial de cada categoría de gasto según la plantilla (0 si la plantilla no la incluye). */
export function porcentajesIniciales(plantilla: Plantilla, categorias: Categoria[]): Map<string, number> {
  const reparto = plantilla.reparto as Record<string, number>;
  const usados = new Set<string>();
  const out = new Map<string, number>();
  for (const c of [...categorias].filter((c) => c.tipo === 'gasto').sort((a, b) => a.orden - b.orden)) {
    const clave = iconoCategoria(c);
    // Si dos categorías comparten icono, el porcentaje es solo para la primera.
    const pct = !usados.has(clave) && reparto[clave] ? reparto[clave] : 0;
    usados.add(clave);
    out.set(c.id, pct);
  }
  return out;
}

/** Límite en céntimos de cada categoría con porcentaje mayor que 0. */
export function limitesPlan(ingreso: number, porcentajes: Map<string, number>) {
  return [...porcentajes]
    .filter(([, pct]) => pct > 0)
    .map(([categoriaId, pct]) => ({ categoriaId, limite: Math.round((ingreso * pct) / 100) }))
    .filter((l) => l.limite > 0);
}

/** Cuánto se reparte en gastos, cuánto queda para ahorrar y si el reparto es válido. */
export function resumenPlan(ingreso: number, porcentajes: Map<string, number>) {
  const pctGasto = [...porcentajes.values()].reduce((s, p) => s + p, 0);
  const gasto = limitesPlan(ingreso, porcentajes).reduce((s, l) => s + l.limite, 0);
  return {
    pctGasto,
    pctAhorro: Math.max(0, 100 - pctGasto),
    gasto,
    ahorro: Math.max(0, ingreso - gasto),
    error: pctGasto > 100 ? 'El reparto supera el 100 % de tus ingresos.' : null,
  };
}

export function porcentajeValido(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '') return 0;
  if (!/^\d{1,3}(\.\d)?$/.test(t)) return null;
  const n = Number(t);
  return n <= 100 ? n : null;
}

/**
 * Ingreso mensual sugerido: la media de los últimos meses completos con ingresos (personales).
 * Si todavía no hay meses completos, usa lo ingresado este mes. Redondeado a euros.
 */
export function ingresoSugerido(movimientos: Movimiento[], cuentas: Cuenta[], hoy: string): number {
  const mesActual = monthKey(hoy);
  const meses = Array.from({ length: config.presupuestos.mesesIngresoSugerido }, (_, i) =>
    addMonths(mesActual, -(i + 1)),
  );
  const conIngresos = serieMensual(movimientos, cuentas, meses).filter((m) => m.ingresos > 0);
  const base = conIngresos.length
    ? conIngresos.reduce((s, m) => s + m.ingresos, 0) / conIngresos.length
    : serieMensual(movimientos, cuentas, [mesActual])[0].ingresos;
  return Math.round(base / 100) * 100;
}
