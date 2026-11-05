import { saldosPorCuenta } from '../lib/balances';
import { crearCuenta, crearMovimiento } from './repo';
import { db, type NetoDB } from './db';
import type { AporteMeta, Meta } from './types';
import { newId } from '../lib/id';
import { addMonths, monthKey, todayISO } from '../lib/dates';
import { mesValido } from '../lib/budgets';
import { esColor } from '../lib/colors';

export function validarMeta(m: Omit<Meta, 'id'>) {
  if (typeof m.nombre !== 'string' || !m.nombre.trim() || m.nombre.length > 80) return 'Pon un nombre de hasta 80 caracteres.';
  if (![m.objetivo, m.inicial, m.mensual].every(n => Number.isSafeInteger(n) && n >= 0) || m.objetivo <= 0 || !Number.isSafeInteger(m.inicial + m.mensual)) return 'Introduce importes válidos y un objetivo mayor que cero.';
  if (typeof m.mesInicio !== 'string' || !mesValido(m.mesInicio) || m.mesInicio < '2000-01') return 'Elige un mes de inicio válido desde el año 2000.';
  if (typeof m.automatica !== 'boolean' || typeof m.activa !== 'boolean') return 'El modo de aportación no es válido.';
  if (m.pausadaDesde != null && (typeof m.pausadaDesde !== 'string' || !mesValido(m.pausadaDesde))) return 'La fecha de pausa no es válida.';
  if (m.cuentaAhorroId != null && (typeof m.cuentaAhorroId !== 'string' || !m.cuentaAhorroId)) return 'La cuenta de ahorro no es válida.';
  if (m.categoriaAhorro != null && !['ahorro','viajes','otros'].includes(m.categoriaAhorro)) return 'El tipo de ahorro no es válido.';
  if (m.cuentaOrigenId != null && (typeof m.cuentaOrigenId !== 'string' || !m.cuentaOrigenId)) return 'Elige una cuenta de origen válida.';
  if (m.porcentaje != null && (!Number.isFinite(m.porcentaje) || m.porcentaje < 0 || m.porcentaje > 100 || !Number.isSafeInteger(m.baseMensual) || m.baseMensual! <= 0)) return 'El porcentaje debe estar entre 0 y 100 y tener un ingreso de referencia positivo.';
  if (m.color != null && !esColor(m.color)) return 'El color no es válido.';
  return null;
}
export function validarAporte(a: Omit<AporteMeta, 'id'>) {
  return typeof a.metaId === 'string' && !!a.metaId && typeof a.mes === 'string' && mesValido(a.mes) && Number.isSafeInteger(a.importe) && a.importe >= 0 && ['plan', 'confirmado', 'transferencia'].includes(a.origen) && (a.origen !== 'transferencia' || (typeof a.movimientoId === 'string' && !!a.movimientoId));
}
/** Reservas internas: transferencias con saldo suficiente y una fila por meta/mes. */
export async function sincronizarMetas(hasta = monthKey(todayISO()), d: NetoDB = db) {
  if (!mesValido(hasta)) throw new Error('Mes no válido.');
  await d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => {
    for (const a of await d.aportesMetas.toArray()) {
      if (a.origen !== 'transferencia') continue;
      const movimiento = a.movimientoId ? await d.movimientos.get(a.movimientoId) : undefined;
      const meta = await d.metas.get(a.metaId);
      const importe = movimiento?.tipo === 'transferencia' && movimiento.cuentaDestinoId === meta?.cuentaAhorroId ? movimiento.importe : 0;
      if (importe !== a.importe) await d.aportesMetas.update(a.id, { importe });
    }
    for (const m of await d.metas.toArray()) {
      if (!m.activa || !m.automatica) continue;
      const aportes = await d.aportesMetas.where('metaId').equals(m.id).toArray();
      const meses = new Set(aportes.map(a => a.mes));
      let total = m.inicial + aportes.reduce((s, a) => s + a.importe, 0);
      for (let mes = m.mesInicio; mes <= hasta; mes = addMonths(mes, 1)) {
        if (meses.has(mes)) continue;
        const importe = Math.max(0, Math.min(m.mensual, m.objetivo - total));
        let movimientoId: string | undefined;
        if (m.cuentaOrigenId && importe > 0) {
          const cuenta = await d.cuentas.get(m.cuentaOrigenId);
          const saldos = saldosPorCuenta(await d.cuentas.toArray(), (await d.movimientos.toArray()).filter(m=>m.fecha<=todayISO()));
          if (!cuenta || cuenta.archivada || cuenta.ambito !== 'personal' || (saldos.get(cuenta.id) ?? 0) < importe || !m.cuentaAhorroId) continue;
          const destino = await d.cuentas.get(m.cuentaAhorroId); if (!destino || destino.archivada) continue;
          movimientoId = await crearMovimiento({ tipo:'transferencia', cuentaId:cuenta.id, cuentaDestinoId:destino.id, importe, fecha:todayISO(), nota:`Reserva para ${m.nombre} · ${mes}`, origen:'recurrente' }, d);
        }
        await d.aportesMetas.add({ id: newId(), metaId: m.id, mes, importe, origen: movimientoId ? 'transferencia' : 'plan', ...(movimientoId ? { movimientoId } : {}) });
        total += importe;
      }
    }
  });
}
export async function guardarMeta(datos: Omit<Meta, 'id'>, id?: string, d: NetoDB = db) {
  if (datos.porcentaje != null && Number.isFinite(datos.porcentaje) && Number.isSafeInteger(datos.baseMensual)) datos = { ...datos, mensual: Math.round(datos.baseMensual! * datos.porcentaje / 100) };
  const error = validarMeta(datos); if (error) throw new Error(error);
  const clave = id ?? newId();
  await d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => {
    const anterior = id ? await d.metas.get(id) : undefined;
    if (id && !anterior) throw new Error('La meta ya no existe.');
    const aportes = await d.aportesMetas.where('metaId').equals(clave).toArray();
    if (!Number.isSafeInteger(aportes.reduce((s, a) => s + a.importe, datos.inicial))) throw new Error('El total supera el importe permitido.');
    const ahora = monthKey(todayISO());
    if (datos.cuentaOrigenId && !anterior?.cuentaOrigenId) {
      const planActual = aportes.find(a => a.mes === ahora && a.origen === 'plan');
      if (planActual) await d.aportesMetas.delete(planActual.id);
    }
    const pausadaDesde = !datos.activa ? (anterior?.pausadaDesde ?? ahora) : null;
    if (datos.activa && anterior && !anterior.activa && anterior.pausadaDesde) {
      for (let mes = anterior.pausadaDesde; mes < ahora; mes = addMonths(mes, 1)) {
        if (!aportes.some(a => a.mes === mes)) await d.aportesMetas.add({ id:newId(), metaId:clave, mes, importe:0, origen:'plan' });
      }
    }
    let cuentaAhorroId = anterior?.cuentaAhorroId ?? null;
    if (datos.cuentaOrigenId) {
      const origen = await d.cuentas.get(datos.cuentaOrigenId);
      if (!origen || origen.archivada || origen.ambito !== 'personal' || datos.cuentaOrigenId === cuentaAhorroId) throw new Error('Elige una cuenta personal de origen disponible, distinta del ahorro de la meta.');
      if (!cuentaAhorroId) cuentaAhorroId = await crearCuenta({ nombre:`Ahorro · ${datos.nombre.trim()}`, tipo:'ahorro', ambito:'personal', saldoInicial:0 }, d);
    }
    await d.metas.put({ ...datos, cuentaAhorroId, pausadaDesde, nombre: datos.nombre.trim(), id: clave });
    await sincronizarMetas(undefined, d);
  });
  return clave;
}
export async function confirmarAporte(metaId: string, mes: string, importe: number, d: NetoDB = db) {
  const datos = { metaId, mes, importe, origen: 'confirmado' as const };
  if (!validarAporte(datos) || mes > monthKey(todayISO())) throw new Error('Introduce una aportación válida de un mes ya iniciado.');
  await d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => {
    const meta = await d.metas.get(metaId); if (!meta) throw new Error('La meta ya no existe.');
    const aportes = await d.aportesMetas.where('metaId').equals(metaId).toArray();
    const actual = aportes.find(a => a.mes === mes);
    if (actual?.origen === 'transferencia') throw new Error('Esta aportación ya tiene una transferencia. Revísala en Movimientos para modificarla.');
    if (!Number.isSafeInteger(aportes.filter(a => a.id !== actual?.id).reduce((s, a) => s + a.importe, meta.inicial + importe))) throw new Error('El total supera el importe permitido.');
    let movimientoId: string | undefined;
    if (meta.cuentaOrigenId && importe > 0) {
      const cuentas = await d.cuentas.toArray(); const movimientos = (await d.movimientos.toArray()).filter(m=>m.fecha<=todayISO());
      const origen = cuentas.find(c=>c.id===meta.cuentaOrigenId); const destino = cuentas.find(c=>c.id===meta.cuentaAhorroId);
      if (!origen || origen.archivada || !destino || destino.archivada || (saldosPorCuenta(cuentas,movimientos).get(origen.id)??0)<importe) throw new Error('La cuenta de origen no tiene saldo disponible suficiente para esta reserva.');
      movimientoId = await crearMovimiento({ tipo:'transferencia', cuentaId:origen.id, cuentaDestinoId:destino.id, importe, fecha:todayISO(), nota:`Aportación a ${meta.nombre} · ${mes}`, origen:'manual' },d);
    }
    await d.aportesMetas.put({ ...datos, id: actual?.id ?? newId(), ...(movimientoId ? { origen:'transferencia' as const, movimientoId } : {}) });
  });
}
export async function borrarMeta(id: string, d: NetoDB = db) {
  await d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => { await d.aportesMetas.where('metaId').equals(id).delete(); await d.metas.delete(id); });
}
