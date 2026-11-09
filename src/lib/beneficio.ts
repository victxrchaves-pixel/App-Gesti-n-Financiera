import type { Cuenta, Factura, GastoNegocio, Movimiento, PerfilNegocio } from '../db/types';
import { aplicarPorcentaje, totalesFactura, trimestreDe } from './facturas';
import { gastoIRPFPeriodo } from './gastosNegocio';
import { inicioTrimestre, modelo303 } from './impuestos';
import { plazoDe } from './plazos';

type Perfil = Pick<PerfilNegocio, 'regimenIVA' | 'regimenIRPF' | 'cuotaMensual' | 'fechaAlta' | 'reservaIRPF'>;

export interface BeneficioReal {
  /** Del 1 de enero a hoy. */
  ingresos: number;
  gastos: number;
  cuota: number;
  /** Ingresos − gastos − cuota de autónomos. */
  beneficio: number;
  retenciones: number;
  /** Lo que queda por pagar de IRPF: reserva % del beneficio menos lo que ya retuvieron los clientes. */
  irpfReservar: number;
  /** IVA de los trimestres cuyo plazo aún no ha terminado. */
  ivaPendiente: number;
  /** Lo que ya te has pasado a lo personal este año (neto). */
  yaTePagaste: number;
  /** Beneficio − IRPF a reservar − lo que ya te pasaste. */
  porBeneficio: number;
  /** Dinero en las cuentas del negocio. */
  dineroNegocio: number;
  /** Dinero del negocio − IVA pendiente − IRPF a reservar. */
  porCaja: number;
  /** Lo que puedes pasarte sin quedarte corto: el menor de los dos. */
  puedesPasarte: number;
  /** Qué pone el límite: el beneficio o el dinero que hay en la cuenta. */
  limita: 'beneficio' | 'caja';
}

/** Meses con cuota de autónomos del 1 de enero (o el alta) al mes de hoy, incluidos. */
export function mesesTranscurridos(hoy: string, fechaAlta: string | null): number {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  if (!fechaAlta || Number(fechaAlta.slice(0, 4)) < anio) return mes;
  if (fechaAlta > hoy) return 0;
  return mes - Number(fechaAlta.slice(5, 7)) + 1;
}

/**
 * Beneficio real del año y cuánto puedes pasarte a lo personal. Es prudente: aparta el IRPF de todo
 * el año y el IVA de los trimestres sin presentar, y nunca propone más de lo que hay en la cuenta.
 */
export function beneficioReal(
  datos: {
    facturas: readonly Pick<Factura, 'fecha' | 'lineas' | 'retencion' | 'cobradaEn'>[];
    gastos: readonly Pick<
      GastoNegocio,
      'fecha' | 'base' | 'cuotaIVA' | 'deducibleIVA' | 'deducibleIRPF' | 'amortizacion'
    >[];
    cuentas: readonly Pick<Cuenta, 'id' | 'ambito'>[];
    movimientos: readonly Pick<Movimiento, 'tipo' | 'fecha' | 'importe' | 'cuentaId' | 'cuentaDestinoId'>[];
    dineroNegocio: number;
  },
  perfil: Perfil,
  hoy: string,
): BeneficioReal {
  const anio = hoy.slice(0, 4);
  const desde = `${anio}-01-01`;
  let ingresos = 0;
  let retenciones = 0;
  for (const f of datos.facturas.filter((x) => x.fecha >= desde && x.fecha <= hoy)) {
    const t = totalesFactura(f.lineas, f.retencion);
    ingresos += t.base;
    retenciones += t.retencion;
  }
  const gastos = gastoIRPFPeriodo(datos.gastos, desde, hoy);
  const cuota = perfil.cuotaMensual * mesesTranscurridos(hoy, perfil.fechaAlta);
  const beneficio = ingresos - gastos - cuota;
  const irpfReservar = Math.max(
    0,
    (beneficio > 0 ? aplicarPorcentaje(beneficio, perfil.reservaIRPF) : 0) - retenciones,
  );

  // IVA de los trimestres empezados cuyo plazo sigue abierto (el anterior, en su mes de plazo, y el actual).
  const actual = trimestreDe(hoy);
  let ivaPendiente = 0;
  for (const q of [
    { anio: actual.t === 1 ? actual.anio - 1 : actual.anio, t: actual.t === 1 ? 4 : actual.t - 1 },
    actual,
  ]) {
    if (inicioTrimestre(q) > hoy || plazoDe(q.anio, q.t).fin < hoy) continue;
    ivaPendiente += Math.max(0, modelo303(datos.facturas, datos.gastos, q, perfil).resultado);
  }

  const ambito = new Map(datos.cuentas.map((c) => [c.id, c.ambito] as const));
  let pasado = 0;
  for (const m of datos.movimientos) {
    if (m.tipo !== 'transferencia' || m.fecha < desde || m.fecha > hoy || !m.cuentaDestinoId) continue;
    const de = ambito.get(m.cuentaId);
    const a = ambito.get(m.cuentaDestinoId);
    if (de === 'negocio' && a === 'personal') pasado += m.importe;
    else if (de === 'personal' && a === 'negocio') pasado -= m.importe;
  }
  const yaTePagaste = Math.max(0, pasado);

  const porBeneficio = Math.max(0, beneficio - irpfReservar - yaTePagaste);
  const porCaja = Math.max(0, datos.dineroNegocio - ivaPendiente - irpfReservar);
  return {
    ingresos,
    gastos,
    cuota,
    beneficio,
    retenciones,
    irpfReservar,
    ivaPendiente,
    yaTePagaste,
    porBeneficio,
    dineroNegocio: datos.dineroNegocio,
    porCaja,
    puedesPasarte: Math.min(porBeneficio, porCaja),
    limita: porCaja < porBeneficio ? 'caja' : 'beneficio',
  };
}
