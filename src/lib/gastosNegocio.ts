import { config } from '../config/neto.config';
import type { GastoNegocio, PerfilNegocio } from '../db/types';
import { addDays, isISODate } from './dates';
import { aplicarPorcentaje } from './facturas';

export type CategoriaGasto = (typeof config.autonomo.categoriasGasto)[number];

export const CATEGORIAS_GASTO: readonly CategoriaGasto[] = config.autonomo.categoriasGasto;

export function categoriaGasto(id: string): CategoriaGasto {
  return CATEGORIAS_GASTO.find((c) => c.id === id) ?? CATEGORIAS_GASTO[CATEGORIAS_GASTO.length - 1];
}

/**
 * Parte de la vivienda dedicada a trabajar, en % (0 si no se han indicado los metros).
 * Se redondea a dos decimales para que el porcentaje se pueda leer y escribir.
 */
export function afectacionVivienda(perfil: Pick<PerfilNegocio, 'metrosVivienda' | 'metrosTrabajo'>): number {
  const v = perfil.metrosVivienda ?? 0;
  const t = perfil.metrosTrabajo ?? 0;
  if (!(v > 0) || !(t > 0)) return 0;
  return Math.round(Math.min(1, t / v) * 10000) / 100;
}

/** Porcentajes deducibles que Neto propone para una categoría. */
export function deduciblesSugeridos(
  categoria: string,
  perfil: Pick<PerfilNegocio, 'metrosVivienda' | 'metrosTrabajo'>,
): { iva: number; irpf: number } {
  const c = categoriaGasto(categoria);
  if (c.id !== 'casa') return { iva: c.iva, irpf: c.irpf };
  // Suministros de casa: el 30 % de la parte de la vivienda dedicada a trabajar.
  const pct = Math.round(c.irpf * afectacionVivienda(perfil)) / 100;
  return { iva: pct, irpf: pct };
}

/** Desde un total con IVA incluido: base y cuota que suman exactamente ese total. */
export function desglosarTotal(total: number, tipoIVA: number): { base: number; cuotaIVA: number } {
  const base = Math.round((total * 100) / (100 + tipoIVA));
  return { base, cuotaIVA: total - base };
}

export interface CifrasGasto {
  /** Lo que pagaste: base + IVA. */
  total: number;
  /** IVA que te devuelve o descuenta Hacienda en el 303. */
  ivaDeducible: number;
  /** Lo que cuenta como gasto en el IRPF. */
  gastoIRPF: number;
}

/**
 * Cifras de un gasto. En el IRPF cuenta la parte de la base que es del negocio y, además, el IVA
 * de esa parte que no se ha podido deducir (por ejemplo, el 50 % de IVA de un coche de uso exclusivo).
 */
export function cifrasGasto(
  g: Pick<GastoNegocio, 'base' | 'cuotaIVA' | 'deducibleIVA' | 'deducibleIRPF'>,
): CifrasGasto {
  const ivaDeducible = aplicarPorcentaje(g.cuotaIVA, g.deducibleIVA);
  const ivaDelNegocio = aplicarPorcentaje(g.cuotaIVA, g.deducibleIRPF);
  const gastoIRPF = aplicarPorcentaje(g.base, g.deducibleIRPF) + Math.max(0, ivaDelNegocio - ivaDeducible);
  return { total: g.base + g.cuotaIVA, ivaDeducible, gastoIRPF };
}

/** Porcentaje anual de reparto que toca a un gasto de esta categoría y base, o null si se deduce de golpe. */
export function amortizacionSugerida(categoria: string, base: number): number | null {
  const { umbral, porCategoria } = config.autonomo.amortizacion;
  const pct = porCategoria[categoria];
  return pct && base > umbral ? pct : null;
}

/** Años (redondeados hacia arriba) en que se reparte un gasto a un porcentaje anual. */
export const aniosDeReparto = (pct: number) => Math.ceil(100 / pct);

const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);

/** Lo repartido de un gasto amortizable desde su compra hasta `fecha` (incluida), en céntimos. */
function amortizadoHasta(total: number, pct: number, compra: string, fecha: string): number {
  if (fecha < compra) return 0;
  const dias = diasEntre(compra, fecha) + 1;
  return Math.min(total, Math.round((total * pct * dias) / (100 * 365)));
}

/**
 * Lo que un gasto cuenta en el IRPF entre dos fechas (incluidas). Un gasto normal cuenta entero en
 * su fecha; uno amortizable se reparte por días desde la compra.
 */
export function gastoIRPFEnPeriodo(
  g: Pick<GastoNegocio, 'fecha' | 'base' | 'cuotaIVA' | 'deducibleIVA' | 'deducibleIRPF' | 'amortizacion'>,
  desde: string,
  hasta: string,
): number {
  const total = cifrasGasto(g).gastoIRPF;
  if (!g.amortizacion) return g.fecha >= desde && g.fecha <= hasta ? total : 0;
  const antes = amortizadoHasta(total, g.amortizacion, g.fecha, addDays(desde, -1));
  return amortizadoHasta(total, g.amortizacion, g.fecha, hasta) - antes;
}

export interface ResumenGastos {
  gastos: number;
  base: number;
  total: number;
  ivaDeducible: number;
  gastoIRPF: number;
}

export function resumirGastos(
  gastos: readonly Pick<GastoNegocio, 'base' | 'cuotaIVA' | 'deducibleIVA' | 'deducibleIRPF'>[],
): ResumenGastos {
  const r: ResumenGastos = { gastos: 0, base: 0, total: 0, ivaDeducible: 0, gastoIRPF: 0 };
  for (const g of gastos) {
    const c = cifrasGasto(g);
    r.gastos++;
    r.base += g.base;
    r.total += c.total;
    r.ivaDeducible += c.ivaDeducible;
    r.gastoIRPF += c.gastoIRPF;
  }
  return r;
}

/** Límite diario de dietas sin pernoctar en España, para avisar si una comida lo supera. */
export const limiteDietaDiaria = config.autonomo.dietas.espana;

export type DatosGastoNegocio = Pick<
  GastoNegocio,
  | 'fecha'
  | 'proveedor'
  | 'numero'
  | 'concepto'
  | 'categoria'
  | 'base'
  | 'tipoIVA'
  | 'cuotaIVA'
  | 'deducibleIVA'
  | 'deducibleIRPF'
  | 'cuentaId'
  | 'nota'
> &
  Pick<Partial<GastoNegocio>, 'amortizacion'>;

const esPct = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

/** Devuelve el primer problema del gasto o null si se puede guardar. */
export function validarGastoNegocio(g: DatosGastoNegocio): string | null {
  if (typeof g.fecha !== 'string' || !isISODate(g.fecha)) return 'La fecha no es válida.';
  if (typeof g.proveedor !== 'string' || !g.proveedor.trim()) return 'Escribe quién te ha cobrado el gasto.';
  if (typeof g.concepto !== 'string' || typeof g.numero !== 'string' || typeof g.nota !== 'string')
    return 'Hay un texto no válido.';
  if (!CATEGORIAS_GASTO.some((c) => c.id === g.categoria)) return 'Elige una categoría.';
  if (!Number.isSafeInteger(g.base) || g.base <= 0) return 'La base tiene que ser mayor que 0.';
  if (!(config.autonomo.iva.tipos as readonly number[]).includes(g.tipoIVA)) return 'Elige un tipo de IVA de la lista.';
  if (!Number.isSafeInteger(g.cuotaIVA) || g.cuotaIVA < 0) return 'El IVA no es válido.';
  // Se admite el céntimo de diferencia de los tickets, pero no un IVA que no cuadra con el tipo.
  if (Math.abs(g.cuotaIVA - aplicarPorcentaje(g.base, g.tipoIVA)) > 2)
    return `El IVA no cuadra con el ${g.tipoIVA} % de la base.`;
  if (!esPct(g.deducibleIVA) || !esPct(g.deducibleIRPF)) return 'Los porcentajes deducibles van de 0 a 100.';
  if (g.amortizacion != null && (!esPct(g.amortizacion) || g.amortizacion <= 0))
    return 'El porcentaje de reparto por año no es válido.';
  return null;
}

/** Suma de lo que cuentan en el IRPF varios gastos entre dos fechas (con el equipo caro repartido). */
export function gastoIRPFPeriodo(
  gastos: readonly Parameters<typeof gastoIRPFEnPeriodo>[0][],
  desde: string,
  hasta: string,
): number {
  return gastos.reduce((s, g) => s + gastoIRPFEnPeriodo(g, desde, hasta), 0);
}
