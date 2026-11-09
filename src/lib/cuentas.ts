import type { Ambito, Cuenta, Movimiento } from '../db/types';
import { addDays, addMonths, lastMonths, monthKey } from './dates';
import { efectoEnCuenta } from './balances';

/**
 * Cuentas tal como las ve la persona: una cuenta visible reúne su propio saldo y el de sus
 * bolsillos internos (las metas dentro del ahorro general).
 */
export function grupoCuenta(id: string, cuentas: Cuenta[]): string[] {
  return [id, ...cuentas.filter((c) => c.cuentaPadreId === id).map((c) => c.id)];
}

/** Saldo de un grupo de cuentas al terminar el día `fecha` (incluido). */
export function saldoEnFecha(ids: string[], cuentas: Cuenta[], movimientos: Movimiento[], fecha: string): number {
  const grupo = new Set(ids);
  let saldo = cuentas.filter((c) => grupo.has(c.id)).reduce((s, c) => s + c.saldoInicial, 0);
  for (const m of movimientos) {
    if (m.fecha > fecha) continue;
    for (const id of grupo) saldo += efectoEnCuenta(m, id);
  }
  return saldo;
}

/** Saldo de un grupo de cuentas cada día entre `desde` y `hasta` (ambos incluidos). */
export function serieSaldoDiaria(
  ids: string[],
  cuentas: Cuenta[],
  movimientos: Movimiento[],
  desde: string,
  hasta: string,
) {
  const grupo = new Set(ids);
  const propios = movimientos
    .filter((m) => grupo.has(m.cuentaId) || (m.cuentaDestinoId !== undefined && grupo.has(m.cuentaDestinoId)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  let saldo = saldoEnFecha(ids, cuentas, propios, addDays(desde, -1));
  const puntos: { fecha: string; valor: number }[] = [];
  let i = 0;
  while (i < propios.length && propios[i].fecha < desde) i++;
  for (let dia = desde; dia <= hasta; dia = addDays(dia, 1)) {
    while (i < propios.length && propios[i].fecha === dia) {
      for (const id of grupo) saldo += efectoEnCuenta(propios[i], id);
      i++;
    }
    puntos.push({ fecha: dia, valor: saldo });
  }
  return puntos;
}

/** Cuentas visibles de un espacio que suman en su patrimonio (sin bolsillos ni cuentas eliminadas). */
export function cuentasPatrimonio(cuentas: Cuenta[], ambito: Ambito = 'personal'): Cuenta[] {
  return cuentas.filter((c) => c.ambito === ambito && !c.eliminada && !c.archivada && !c.cuentaPadreId);
}

/** Patrimonio al cierre de cada uno de los `n` meses que terminan en `mesFinal` (el actual, hasta hoy). */
export function patrimonioMensual(
  cuentas: Cuenta[],
  movimientos: Movimiento[],
  mesFinal: string,
  n: number,
  hoy: string,
  ambito: Ambito = 'personal',
) {
  const ids = cuentasPatrimonio(cuentas, ambito).flatMap((c) => grupoCuenta(c.id, cuentas));
  return lastMonths(mesFinal, n).map((mes) => {
    const cierre = mes === monthKey(hoy) ? hoy : addDays(`${addMonths(mes, 1)}-01`, -1);
    return { mes, valor: saldoEnFecha(ids, cuentas, movimientos, cierre) };
  });
}

/**
 * Lo que entra y sale de un grupo de cuentas en un mes. Los traspasos entre cuentas del
 * mismo grupo (por ejemplo, del ahorro general a una meta) no cuentan.
 */
export function flujoMes(ids: string[], movimientos: Movimiento[], mes: string, hoy: string) {
  const grupo = new Set(ids);
  let entradas = 0;
  let salidas = 0;
  for (const m of movimientos) {
    if (monthKey(m.fecha) !== mes || m.fecha > hoy) continue;
    const desde = grupo.has(m.cuentaId);
    const hacia = m.cuentaDestinoId !== undefined && grupo.has(m.cuentaDestinoId);
    if (m.tipo === 'ingreso' && desde) entradas += m.importe;
    else if (m.tipo === 'gasto' && desde) salidas += m.importe;
    else if (m.tipo === 'transferencia' && desde !== hacia) {
      if (hacia) entradas += m.importe;
      else salidas += m.importe;
    }
  }
  return { entradas, salidas, neto: entradas - salidas };
}

/** Último movimiento hasta hoy que afecta al grupo (sin contar repartos internos). */
export function ultimoMovimiento(ids: string[], movimientos: Movimiento[], hoy: string): Movimiento | undefined {
  const grupo = new Set(ids);
  return movimientos
    .filter((m) => m.fecha <= hoy)
    .filter((m) => {
      const desde = grupo.has(m.cuentaId);
      const hacia = m.cuentaDestinoId !== undefined && grupo.has(m.cuentaDestinoId);
      return m.tipo === 'transferencia' ? desde !== hacia : desde;
    })
    .sort((a, b) => (a.fecha === b.fecha ? b.creadoEn.localeCompare(a.creadoEn) : b.fecha.localeCompare(a.fecha)))[0];
}
