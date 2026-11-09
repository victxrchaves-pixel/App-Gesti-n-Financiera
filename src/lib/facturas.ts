import { config } from '../config/neto.config';
import type { Factura, LineaFactura, PerfilNegocio } from '../db/types';
import { addDays, isISODate } from './dates';

/** Perfil fiscal cuando la persona todavía no ha rellenado «Tu negocio» en Ajustes. */
export const PERFIL_POR_DEFECTO: PerfilNegocio = {
  actividad: 'profesional',
  fechaAlta: null,
  nuevoAutonomo: false,
  regimenIVA: 'devengo',
  regimenIRPF: 'simplificada',
  cuotaMensual: 0,
  reservaIRPF: config.autonomo.irpf.reservaPorDefecto,
};

export function perfilNegocio(perfil?: Partial<PerfilNegocio> | null): PerfilNegocio {
  return { ...PERFIL_POR_DEFECTO, ...(perfil ?? {}) };
}

export interface CuotaIVA {
  tipo: number;
  base: number;
  cuota: number;
}

export interface TotalesFactura {
  /** Suma de bases imponibles, en céntimos. */
  base: number;
  /** IVA repercutido, agrupado por tipo. */
  porTipo: CuotaIVA[];
  iva: number;
  retencion: number;
  /** Lo que paga el cliente: base + IVA − retención. */
  total: number;
}

/** Porcentaje de una cantidad en céntimos, redondeado al céntimo (0,5 sube). */
export function aplicarPorcentaje(base: number, pct: number): number {
  const v = (base * pct) / 100;
  return Math.sign(v) * Math.round(Math.abs(v) + 1e-9);
}

/**
 * Totales de una factura. El IVA se calcula sobre la base de cada tipo (no línea a línea), como se
 * declara en el modelo 303, y la retención sobre la base total.
 */
export function totalesFactura(lineas: readonly LineaFactura[], retencionPct: number): TotalesFactura {
  const bases = new Map<number, number>();
  for (const l of lineas) bases.set(l.tipoIVA, (bases.get(l.tipoIVA) ?? 0) + l.base);
  const porTipo = [...bases]
    .sort((a, b) => b[0] - a[0])
    .map(([tipo, base]) => ({ tipo, base, cuota: aplicarPorcentaje(base, tipo) }));
  const base = porTipo.reduce((s, t) => s + t.base, 0);
  const iva = porTipo.reduce((s, t) => s + t.cuota, 0);
  const retencion = aplicarPorcentaje(base, retencionPct);
  return { base, porTipo, iva, retencion, total: base + iva - retencion };
}

/**
 * Retención que Neto propone para una factura. Las actividades empresariales no llevan; las
 * profesionales llevan la general o la reducida si es nuevo autónomo (año de alta y los dos siguientes).
 */
export function retencionSugerida(perfil: PerfilNegocio, fechaFactura: string): number {
  const { irpf } = config.autonomo;
  if (perfil.actividad !== 'profesional') return 0;
  if (!perfil.nuevoAutonomo) return irpf.retencion;
  if (!perfil.fechaAlta) return irpf.retencionNuevoAutonomo;
  const anioAlta = Number(perfil.fechaAlta.slice(0, 4));
  const anio = Number(fechaFactura.slice(0, 4));
  return anio >= anioAlta && anio <= anioAlta + irpf.aniosRetencionReducida
    ? irpf.retencionNuevoAutonomo
    : irpf.retencion;
}

/** Separa el contador de un número de factura; con el año al final («014/2026») el contador es el de antes. */
function partirNumero(n: string) {
  const t = n.trim();
  const m = /^(.*?)(\d+)(\D+(?:19|20)\d{2}\D*)$/.exec(t) ?? /^(.*?)(\d+)(\D*)$/.exec(t);
  return m ? { prefijo: m[1], cifras: m[2], sufijo: m[3], valor: Number(m[2]) } : null;
}

const ANIO = /(?<!\d)(?:19|20)\d{2}(?!\d)/;

/**
 * Número que se propone para la siguiente factura:
 * - si ya hay facturas de ese año con el año en el número («2026-014», «F2026/3»), sigue la serie;
 * - si la última serie es de otro año, empieza la del año nuevo con el mismo formato («2025-014» → «2026-001»);
 * - si la numeración no lleva año («37»), sigue contando;
 * - si no hay ninguna, propone AAAA-001.
 */
export function siguienteNumero(numeros: readonly string[], anio: number): string {
  const conAnio = numeros
    .map((n) => ({ n: n.trim(), anio: Number(ANIO.exec(n)?.[0] ?? NaN), p: partirNumero(n) }))
    .filter((x) => x.p && Number.isFinite(x.anio) && x.p.cifras !== String(x.anio));
  const deEsteAnio = conAnio.filter((x) => x.anio === anio);
  if (deEsteAnio.length) {
    const u = deEsteAnio.reduce((a, b) => (b.p!.valor > a.p!.valor ? b : a)).p!;
    return `${u.prefijo}${String(u.valor + 1).padStart(u.cifras.length, '0')}${u.sufijo}`;
  }
  const anteriores = conAnio.filter((x) => x.anio < anio);
  if (anteriores.length) {
    const u = anteriores.reduce((a, b) => (b.anio > a.anio || (b.anio === a.anio && b.p!.valor > a.p!.valor) ? b : a));
    const p = u.p!;
    return `${p.prefijo.replace(ANIO, String(anio))}${'1'.padStart(p.cifras.length, '0')}${p.sufijo.replace(ANIO, String(anio))}`;
  }
  const sinAnio = numeros
    .filter((n) => !ANIO.test(n))
    .map(partirNumero)
    .filter((p) => p !== null);
  if (sinAnio.length) {
    const u = sinAnio.reduce((a, b) => (b.valor > a.valor ? b : a));
    return `${u.prefijo}${String(u.valor + 1).padStart(u.cifras.length, '0')}${u.sufijo}`;
  }
  return `${anio}-${'1'.padStart(config.autonomo.cifrasNumeroFactura, '0')}`;
}

export function vencimientoSugerido(fecha: string): string {
  return addDays(fecha, config.autonomo.diasVencimientoFactura);
}

export type EstadoFactura = 'cobrada' | 'pendiente' | 'vencida';

export function estadoFactura(f: Pick<Factura, 'cobradaEn' | 'vencimiento'>, hoy: string): EstadoFactura {
  if (f.cobradaEn) return 'cobrada';
  return f.vencimiento < hoy ? 'vencida' : 'pendiente';
}

export interface Trimestre {
  anio: number;
  /** 1 a 4. */
  t: number;
}

export function trimestreDe(fecha: string): Trimestre {
  return { anio: Number(fecha.slice(0, 4)), t: Math.floor((Number(fecha.slice(5, 7)) - 1) / 3) + 1 };
}

export function enTrimestre(fecha: string, q: Trimestre): boolean {
  const x = trimestreDe(fecha);
  return x.anio === q.anio && x.t === q.t;
}

export function moverTrimestre(q: Trimestre, n: number): Trimestre {
  const i = q.anio * 4 + (q.t - 1) + n;
  return { anio: Math.floor(i / 4), t: (i % 4) + 1 };
}

export function nombreTrimestre(q: Trimestre): string {
  return `${q.t}.º trimestre de ${q.anio}`;
}

export interface ResumenFacturas {
  facturas: number;
  base: number;
  iva: number;
  retencion: number;
  total: number;
}

export function resumirFacturas(facturas: readonly Pick<Factura, 'lineas' | 'retencion'>[]): ResumenFacturas {
  const r: ResumenFacturas = { facturas: 0, base: 0, iva: 0, retencion: 0, total: 0 };
  for (const f of facturas) {
    const t = totalesFactura(f.lineas, f.retencion);
    r.facturas++;
    r.base += t.base;
    r.iva += t.iva;
    r.retencion += t.retencion;
    r.total += t.total;
  }
  return r;
}

export type DatosFactura = Pick<
  Factura,
  'numero' | 'fecha' | 'vencimiento' | 'clienteNombre' | 'lineas' | 'retencion' | 'nota'
> & { clienteNif?: string };

/** Devuelve el primer problema de la factura o null si se puede guardar. */
export function validarFactura(f: DatosFactura): string | null {
  const { autonomo } = config;
  if (typeof f.numero !== 'string' || !f.numero.trim()) return 'Escribe el número de la factura.';
  if (f.numero.trim().length > 40) return 'El número de factura es demasiado largo.';
  if (typeof f.fecha !== 'string' || !isISODate(f.fecha)) return 'La fecha de la factura no es válida.';
  if (typeof f.vencimiento !== 'string' || !isISODate(f.vencimiento)) return 'La fecha de vencimiento no es válida.';
  if (f.vencimiento < f.fecha) return 'El vencimiento no puede ser anterior a la fecha de la factura.';
  if (typeof f.clienteNombre !== 'string' || !f.clienteNombre.trim()) return 'Escribe a quién va la factura.';
  if (!Array.isArray(f.lineas) || !f.lineas.length) return 'Añade al menos un concepto.';
  for (const l of f.lineas) {
    if (!l || typeof l.concepto !== 'string') return 'Hay un concepto no válido.';
    if (!Number.isSafeInteger(l.base) || l.base <= 0) return 'Cada concepto necesita una base mayor que 0.';
    if (!(autonomo.iva.tipos as readonly number[]).includes(l.tipoIVA)) return 'Elige un tipo de IVA de la lista.';
  }
  if (!(autonomo.irpf.tipos as readonly number[]).includes(f.retencion)) return 'Elige una retención de la lista.';
  return null;
}

/** Devuelve el primer problema del perfil fiscal o null si es válido. */
export function validarPerfilNegocio(p: PerfilNegocio): string | null {
  if (!['profesional', 'empresarial'].includes(p.actividad)) return 'Elige el tipo de actividad.';
  if (p.fechaAlta !== null && (typeof p.fechaAlta !== 'string' || !isISODate(p.fechaAlta)))
    return 'La fecha de alta no es válida.';
  if (typeof p.nuevoAutonomo !== 'boolean') return 'Indica si eres nuevo autónomo.';
  if (!['devengo', 'caja'].includes(p.regimenIVA)) return 'Elige cuándo declaras el IVA.';
  if (!['simplificada', 'normal'].includes(p.regimenIRPF)) return 'Elige tu régimen de IRPF.';
  if (!Number.isSafeInteger(p.cuotaMensual) || p.cuotaMensual < 0) return 'La cuota de autónomos no es válida.';
  if (typeof p.reservaIRPF !== 'number' || !Number.isFinite(p.reservaIRPF) || p.reservaIRPF < 0 || p.reservaIRPF > 60)
    return 'La reserva para el IRPF tiene que estar entre 0 % y 60 %.';
  for (const m of [p.metrosVivienda, p.metrosTrabajo])
    if (m != null && (typeof m !== 'number' || !Number.isFinite(m) || m <= 0 || m > 10000))
      return 'Escribe los metros como un número mayor que 0.';
  if (p.metrosVivienda != null && p.metrosTrabajo != null && p.metrosTrabajo > p.metrosVivienda)
    return 'La zona de trabajo no puede ser más grande que la vivienda.';
  return null;
}
