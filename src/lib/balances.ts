import { todayISO } from './dates';
import type { Ambito, Cuenta, Movimiento } from '../db/types';

/** Efecto de un movimiento sobre el saldo de una cuenta concreta. */
export function efectoEnCuenta(m: Movimiento, cuentaId: string): number {
  switch (m.tipo) {
    case 'ingreso':
      return m.cuentaId === cuentaId ? m.importe : 0;
    case 'gasto':
      return m.cuentaId === cuentaId ? -m.importe : 0;
    case 'transferencia': {
      let e = 0;
      if (m.cuentaId === cuentaId) e -= m.importe;
      if (m.cuentaDestinoId === cuentaId) e += m.importe;
      return e;
    }
  }
}

/** Saldo de cada cuenta: saldo inicial + efecto de todos sus movimientos. */
export function saldosPorCuenta(cuentas: Cuenta[], movimientos: Movimiento[]): Map<string, number> {
  const saldos = new Map<string, number>();
  for (const c of cuentas) saldos.set(c.id, c.saldoInicial);
  const sumar = (id: string | undefined, v: number) => {
    if (id !== undefined && saldos.has(id)) saldos.set(id, saldos.get(id)! + v);
  };
  for (const m of movimientos.filter(m=>m.fecha<=todayISO())) {
    if (m.tipo === 'ingreso') sumar(m.cuentaId, m.importe);
    else if (m.tipo === 'gasto') sumar(m.cuentaId, -m.importe);
    else {
      sumar(m.cuentaId, -m.importe);
      sumar(m.cuentaDestinoId, m.importe);
    }
  }
  return saldos;
}

/**
 * Patrimonio: suma de los saldos de todas las cuentas vigentes.
 * Si se indica un ámbito, solo cuenta las cuentas de ese ámbito.
 */
export function patrimonio(cuentas: Cuenta[], movimientos: Movimiento[], ambito?: Ambito): number {
  const saldos = saldosPorCuenta(cuentas, movimientos);
  let total = 0;
  for (const c of cuentas) {
    if (c.eliminada || c.archivada) continue;
    if (ambito && c.ambito !== ambito) continue;
    total += saldos.get(c.id) ?? 0;
  }
  return total;
}

/** Disponible real: saldos de uso, excluyendo cuentas de ahorro y cuentas eliminadas. */
export function dineroDisponible(cuentas: Cuenta[], movimientos: Movimiento[]) {
  const saldos=saldosPorCuenta(cuentas,movimientos);
  let total=0, ahorro=0;
  for(const c of cuentas) {
    if(c.ambito!=='personal'||c.eliminada||c.archivada)continue;
    const saldo=saldos.get(c.id)??0;total+=saldo;
    if(c.tipo==='ahorro')ahorro+=saldo;
  }
  return {total,ahorro,disponible:total-ahorro};
}
