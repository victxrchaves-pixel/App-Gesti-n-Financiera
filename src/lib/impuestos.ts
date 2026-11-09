import { config } from '../config/neto.config';
import type { Factura, GastoNegocio, PerfilNegocio } from '../db/types';
import {
  aplicarPorcentaje,
  enTrimestre,
  moverTrimestre,
  totalesFactura,
  trimestreDe,
  type Trimestre,
} from './facturas';
import { cifrasGasto } from './gastosNegocio';

type FacturaFiscal = Pick<Factura, 'fecha' | 'lineas' | 'retencion' | 'cobradaEn'>;
type GastoFiscal = Pick<GastoNegocio, 'fecha' | 'base' | 'cuotaIVA' | 'deducibleIVA' | 'deducibleIRPF'>;
type Perfil = Pick<PerfilNegocio, 'regimenIVA' | 'regimenIRPF' | 'cuotaMensual' | 'fechaAlta'>;

const pad = (n: number) => String(n).padStart(2, '0');
export const inicioTrimestre = (q: Trimestre) => `${q.anio}-${pad((q.t - 1) * 3 + 1)}-01`;
export function finTrimestre(q: Trimestre): string {
  const mes = q.t * 3;
  const ultimo = new Date(Date.UTC(q.anio, mes, 0)).getUTCDate();
  return `${q.anio}-${pad(mes)}-${pad(ultimo)}`;
}
const anterior = (a: Trimestre, b: Trimestre) => a.anio * 4 + a.t < b.anio * 4 + b.t;

// ── Modelo 303: IVA ────────────────────────────────────────────────────────

export interface Iva303 {
  trimestre: Trimestre;
  /** IVA de tus facturas, por tipo. */
  devengado: { tipo: number; base: number; cuota: number }[];
  ivaDevengado: number;
  /** IVA de tus gastos que puedes deducir. */
  ivaDeducible: number;
  /** Lo que sale este trimestre antes de compensar: devengado − deducible. */
  diferencia: number;
  /** Saldo a tu favor que viene de trimestres anteriores. */
  compensadoAnterior: number;
  /** Positivo: a pagar. Negativo: a tu favor (se compensa después, o se pide la devolución en el 4.º). */
  resultado: number;
}

/**
 * Facturas cuyo IVA cuenta en el trimestre. Al emitirlas (lo habitual): por fecha de la factura.
 * Con criterio de caja: al cobrarlas o, si siguen sin cobrar, el 31 de diciembre del año siguiente.
 */
function facturasDelTrimestre(facturas: readonly FacturaFiscal[], q: Trimestre, perfil: Perfil) {
  if (perfil.regimenIVA !== 'caja') return facturas.filter((f) => enTrimestre(f.fecha, q));
  return facturas.filter((f) => {
    const limite = `${Number(f.fecha.slice(0, 4)) + 1}-12-31`;
    if (f.cobradaEn && f.cobradaEn <= limite) return enTrimestre(f.cobradaEn, q);
    return enTrimestre(limite, q);
  });
}

function iva303Simple(
  facturas: readonly FacturaFiscal[],
  gastos: readonly GastoFiscal[],
  q: Trimestre,
  perfil: Perfil,
) {
  const bases = new Map<number, number>();
  for (const f of facturasDelTrimestre(facturas, q, perfil))
    for (const l of f.lineas) if (l.tipoIVA > 0) bases.set(l.tipoIVA, (bases.get(l.tipoIVA) ?? 0) + l.base);
  const devengado = [...bases]
    .sort((a, b) => b[0] - a[0])
    .map(([tipo, base]) => ({ tipo, base, cuota: aplicarPorcentaje(base, tipo) }));
  const ivaDevengado = devengado.reduce((s, d) => s + d.cuota, 0);
  const ivaDeducible = gastos
    .filter((g) => enTrimestre(g.fecha, q))
    .reduce((s, g) => s + cifrasGasto(g).ivaDeducible, 0);
  return { devengado, ivaDevengado, ivaDeducible, diferencia: ivaDevengado - ivaDeducible };
}

/**
 * IVA del trimestre. Los saldos a favor de trimestres anteriores se compensan hasta agotarse
 * (Neto supone que no se pidió la devolución en el 4.º trimestre).
 */
export function modelo303(
  facturas: readonly FacturaFiscal[],
  gastos: readonly GastoFiscal[],
  q: Trimestre,
  perfil: Perfil,
): Iva303 {
  const fechas = [...facturas.map((f) => f.fecha), ...gastos.map((g) => g.fecha)].sort();
  let cursor = fechas.length ? trimestreDe(fechas[0]) : q;
  let aFavor = 0;
  while (anterior(cursor, q)) {
    const r = iva303Simple(facturas, gastos, cursor, perfil).diferencia - aFavor;
    aFavor = r < 0 ? -r : 0;
    cursor = moverTrimestre(cursor, 1);
  }
  const actual = iva303Simple(facturas, gastos, q, perfil);
  return { trimestre: q, ...actual, compensadoAnterior: aFavor, resultado: actual.diferencia - aFavor };
}

// ── Modelo 130: pago a cuenta del IRPF ─────────────────────────────────────

export interface Irpf130 {
  trimestre: Trimestre;
  /** Desde el 1 de enero hasta el final del trimestre. */
  ingresos: number;
  gastosFacturas: number;
  cuotaAutonomos: number;
  /** 5 % de gastos de difícil justificación (solo estimación directa simplificada). */
  dificilJustificacion: number;
  gastos: number;
  rendimiento: number;
  /** 20 % del rendimiento (si es positivo). */
  cuotaBruta: number;
  retenciones: number;
  pagosAnteriores: number;
  /** Lo que se paga este trimestre (nunca negativo). */
  resultado: number;
}

/** Meses del año que van del 1 de enero (o el alta) al final del trimestre: los que pagas cuota. */
export function mesesDeCuota(q: Trimestre, fechaAlta: string | null): number {
  const finMes = q.t * 3;
  if (!fechaAlta || Number(fechaAlta.slice(0, 4)) < q.anio) return finMes;
  if (Number(fechaAlta.slice(0, 4)) > q.anio) return 0;
  return Math.max(0, finMes - Number(fechaAlta.slice(5, 7)) + 1);
}

function irpfAcumulado(
  facturas: readonly FacturaFiscal[],
  gastos: readonly GastoFiscal[],
  q: Trimestre,
  perfil: Perfil,
) {
  const desde = `${q.anio}-01-01`;
  const hasta = finTrimestre(q);
  const enPeriodo = (f: string) => f >= desde && f <= hasta;
  let ingresos = 0;
  let retenciones = 0;
  for (const f of facturas.filter((x) => enPeriodo(x.fecha))) {
    const t = totalesFactura(f.lineas, f.retencion);
    ingresos += t.base;
    retenciones += t.retencion;
  }
  const gastosFacturas = gastos.filter((g) => enPeriodo(g.fecha)).reduce((s, g) => s + cifrasGasto(g).gastoIRPF, 0);
  const cuotaAutonomos = perfil.cuotaMensual * mesesDeCuota(q, perfil.fechaAlta);
  const previo = ingresos - gastosFacturas - cuotaAutonomos;
  const { porcentaje, maximoAnual } = config.autonomo.dificilJustificacion;
  const dificilJustificacion =
    perfil.regimenIRPF === 'simplificada' && previo > 0
      ? Math.min(aplicarPorcentaje(previo, porcentaje), maximoAnual)
      : 0;
  const gastosTotal = gastosFacturas + cuotaAutonomos + dificilJustificacion;
  const rendimiento = ingresos - gastosTotal;
  const cuotaBruta = rendimiento > 0 ? aplicarPorcentaje(rendimiento, config.autonomo.irpf.pagoFraccionado) : 0;
  return {
    ingresos,
    gastosFacturas,
    cuotaAutonomos,
    dificilJustificacion,
    gastos: gastosTotal,
    rendimiento,
    cuotaBruta,
    retenciones,
  };
}

/** Pago fraccionado del trimestre: 20 % del rendimiento del año hasta hoy, menos retenciones y pagos ya hechos. */
export function modelo130(
  facturas: readonly FacturaFiscal[],
  gastos: readonly GastoFiscal[],
  q: Trimestre,
  perfil: Perfil,
): Irpf130 {
  let pagosAnteriores = 0;
  for (let t = 1; t < q.t; t++) {
    const a = irpfAcumulado(facturas, gastos, { anio: q.anio, t }, perfil);
    pagosAnteriores += Math.max(0, a.cuotaBruta - a.retenciones - pagosAnteriores);
  }
  const acumulado = irpfAcumulado(facturas, gastos, q, perfil);
  const resultado = Math.max(0, acumulado.cuotaBruta - acumulado.retenciones - pagosAnteriores);
  return { trimestre: q, ...acumulado, pagosAnteriores, resultado };
}

/**
 * Parte de los ingresos del año que llevó retención. Con un 70 % o más el año anterior,
 * el modelo 130 no es obligatorio. Devuelve null si ese año no hay facturas.
 */
export function porcentajeConRetencion(facturas: readonly FacturaFiscal[], anio: number): number | null {
  let total = 0;
  let conRetencion = 0;
  for (const f of facturas.filter((x) => x.fecha.startsWith(`${anio}-`))) {
    const base = totalesFactura(f.lineas, f.retencion).base;
    total += base;
    if (f.retencion > 0) conRetencion += base;
  }
  return total > 0 ? Math.round((conRetencion / total) * 1000) / 10 : null;
}

export function exentoDel130(facturas: readonly FacturaFiscal[], anio: number): boolean {
  const p = porcentajeConRetencion(facturas, anio - 1);
  return p !== null && p >= config.autonomo.exencion130PorRetenciones;
}
