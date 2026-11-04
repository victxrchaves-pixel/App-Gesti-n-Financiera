import type { Ambito, Cuenta, Movimiento } from '../db/types';
import { lastMonths, monthKey } from './dates';

/**
 * Cómo cuenta cada movimiento para un ámbito (personal o negocio):
 * - Ingresos y gastos cuentan en el ámbito de su cuenta.
 * - Las transferencias dentro del mismo ámbito no son ni ingreso ni gasto (el dinero sigue siendo tuyo).
 * - Una transferencia de una cuenta del negocio a una personal ("Me pago a mí") cuenta como
 *   ingreso personal y NO como gasto del negocio.
 */
export interface Clasificacion {
  ingreso: number;
  gasto: number;
}

export function clasificar(m: Movimiento, ambitoDe: (cuentaId: string | undefined) => Ambito | undefined, ambito: Ambito): Clasificacion {
  const origen = ambitoDe(m.cuentaId);
  if (m.tipo === 'ingreso') return { ingreso: origen === ambito ? m.importe : 0, gasto: 0 };
  if (m.tipo === 'gasto') return { ingreso: 0, gasto: origen === ambito ? m.importe : 0 };
  const destino = ambitoDe(m.cuentaDestinoId);
  if (ambito === 'personal' && origen === 'negocio' && destino === 'personal') return { ingreso: m.importe, gasto: 0 };
  return { ingreso: 0, gasto: 0 };
}

function indiceAmbitos(cuentas: Cuenta[]) {
  const mapa = new Map(cuentas.map((c) => [c.id, c.ambito] as const));
  return (id: string | undefined) => (id === undefined ? undefined : mapa.get(id));
}

export interface ResumenMes {
  mes: string;
  ingresos: number;
  gastos: number;
  /** ingresos − gastos */
  neto: number;
}

export function resumenMes(movimientos: Movimiento[], cuentas: Cuenta[], mes: string, ambito: Ambito = 'personal'): ResumenMes {
  return serieMensual(movimientos, cuentas, [mes], ambito)[0];
}

/** Ingresos y gastos de cada mes de `meses`, en el mismo orden. */
export function serieMensual(movimientos: Movimiento[], cuentas: Cuenta[], meses: string[], ambito: Ambito = 'personal'): ResumenMes[] {
  const ambitoDe = indiceAmbitos(cuentas);
  const acc = new Map(meses.map((mes) => [mes, { mes, ingresos: 0, gastos: 0, neto: 0 }]));
  for (const m of movimientos) {
    const fila = acc.get(monthKey(m.fecha));
    if (!fila) continue;
    const c = clasificar(m, ambitoDe, ambito);
    fila.ingresos += c.ingreso;
    fila.gastos += c.gasto;
  }
  for (const fila of acc.values()) fila.neto = fila.ingresos - fila.gastos;
  return meses.map((mes) => acc.get(mes)!);
}

export function ultimosMeses(movimientos: Movimiento[], cuentas: Cuenta[], mesFinal: string, n: number, ambito: Ambito = 'personal'): ResumenMes[] {
  return serieMensual(movimientos, cuentas, lastMonths(mesFinal, n), ambito);
}

export interface GastoCategoria {
  categoriaId: string | undefined;
  importe: number;
}

/** Gasto del mes agrupado por categoría, de mayor a menor. */
export function gastoPorCategoria(movimientos: Movimiento[], cuentas: Cuenta[], mes: string, ambito: Ambito = 'personal'): GastoCategoria[] {
  const ambitoDe = indiceAmbitos(cuentas);
  const acc = new Map<string | undefined, number>();
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || monthKey(m.fecha) !== mes || ambitoDe(m.cuentaId) !== ambito) continue;
    acc.set(m.categoriaId, (acc.get(m.categoriaId) ?? 0) + m.importe);
  }
  return [...acc.entries()]
    .map(([categoriaId, importe]) => ({ categoriaId, importe }))
    .sort((a, b) => b.importe - a.importe);
}

/** Ordena por fecha descendente y, a igual fecha, por hora de creación descendente. */
export function ordenarMovimientos(movimientos: Movimiento[]): Movimiento[] {
  return [...movimientos].sort((a, b) =>
    a.fecha === b.fecha ? b.creadoEn.localeCompare(a.creadoEn) : b.fecha.localeCompare(a.fecha),
  );
}
