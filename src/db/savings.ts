import type { NetoDB } from './db';
import { newId } from '../lib/id';
import { saldosDirectos } from '../lib/balances';
import { todayISO, monthKey } from '../lib/dates';

/** Una sola cuenta de ahorro visible; cada meta lleva su propio bolsillo interno. */
export async function agruparAhorro(d: Pick<NetoDB, 'cuentas' | 'metas'>, crearSiVacio = false) {
  const cuentas = await d.cuentas.toArray();
  const ahorro = cuentas.filter((c) => c.ambito === 'personal' && c.tipo === 'ahorro' && !c.eliminada && !c.archivada);
  if (!ahorro.length && !crearSiVacio) return undefined;
  const metas = await d.metas.toArray();
  const vinculadas = new Set(metas.map((m) => m.cuentaAhorroId));
  let general =
    ahorro.find((c) => c.ahorroGeneral && !c.cuentaPadreId) ??
    ahorro.find((c) => !vinculadas.has(c.id) && c.nombre.trim().toLocaleLowerCase() === 'ahorro') ??
    ahorro.find((c) => !vinculadas.has(c.id) && !c.cuentaPadreId);
  if (!general) {
    general = {
      id: newId(),
      nombre: 'Ahorro',
      tipo: 'ahorro',
      ambito: 'personal',
      saldoInicial: 0,
      archivada: false,
      ahorroGeneral: true,
      orden: cuentas.length,
      creadaEn: new Date().toISOString(),
    };
    await d.cuentas.add(general);
  } else if (!general.ahorroGeneral || general.cuentaPadreId) {
    await d.cuentas.update(general.id, { ahorroGeneral: true, cuentaPadreId: undefined, bolsilloMetaId: undefined });
  }
  for (const c of ahorro) {
    if (c.id === general.id) continue;
    const meta = metas.find((m) => m.cuentaAhorroId === c.id);
    if (c.cuentaPadreId !== general.id || c.ahorroGeneral || (meta && c.bolsilloMetaId !== meta.id))
      await d.cuentas.update(c.id, {
        cuentaPadreId: general.id,
        ahorroGeneral: false,
        ...(meta ? { bolsilloMetaId: meta.id } : {}),
      });
  }
  return general.id;
}

export async function crearBolsilloMeta(metaId: string, nombre: string, d: NetoDB) {
  const padre = await agruparAhorro(d, true);
  const id = newId();
  await d.cuentas.add({
    id,
    nombre: `Meta · ${nombre.trim()}`,
    tipo: 'ahorro',
    ambito: 'personal',
    saldoInicial: 0,
    archivada: false,
    cuentaPadreId: padre,
    bolsilloMetaId: metaId,
    orden: await d.cuentas.count(),
    creadaEn: new Date().toISOString(),
  });
  return id;
}

/** El ahorro general antiguo y los ingresos directos pertenecen siempre a la meta Ahorro general. */
export async function asignarAhorroGeneral(d: NetoDB) {
  return d.transaction('rw', d.cuentas, d.metas, d.movimientos, d.aportesMetas, async () => {
    const cuentas = await d.cuentas.toArray();
    const padre = cuentas.find((c) => c.ahorroGeneral && !c.eliminada && !c.archivada);
    if (!padre) return;
    const saldos = saldosDirectos(cuentas, await d.movimientos.toArray());
    const origenes = cuentas.filter(
      (c) =>
        !c.eliminada &&
        !c.archivada &&
        (c.id === padre.id || (c.cuentaPadreId === padre.id && !c.bolsilloMetaId)) &&
        (saldos.get(c.id) ?? 0) > 0,
    );
    if (!origenes.length) return;
    const metas = await d.metas.toArray();
    let meta = metas.find(
      (m) =>
        m.nombre === 'Ahorro general' &&
        cuentas.some((c) => c.id === m.cuentaAhorroId && c.cuentaPadreId === padre.id && !c.eliminada),
    );
    if (!meta) {
      const id = newId(),
        cuentaAhorroId = await crearBolsilloMeta(id, 'Ahorro general', d);
      meta = {
        id,
        nombre: 'Ahorro general',
        // Sin objetivo: reúne el ahorro que no tiene otro destino, sin inventar una cifra.
        objetivo: 0,
        inicial: 0,
        mensual: 0,
        mesInicio: monthKey(todayISO()),
        automatica: false,
        activa: true,
        categoriaAhorro: 'ahorro',
        cuentaOrigenId: padre.id,
        cuentaAhorroId,
      };
      await d.metas.add(meta);
    }
    for (const origen of origenes) {
      const id = newId(),
        cantidad = saldos.get(origen.id)!,
        ahora = new Date().toISOString();
      await d.movimientos.add({
        id,
        tipo: 'transferencia',
        fecha: todayISO(),
        importe: cantidad,
        cuentaId: origen.id,
        cuentaDestinoId: meta.cuentaAhorroId!,
        nota: 'Asignación a la meta Ahorro general',
        origen: 'manual',
        creadoEn: ahora,
        actualizadoEn: ahora,
      });
      await d.aportesMetas.add({
        id: newId(),
        metaId: meta.id,
        importe: cantidad,
        mes: monthKey(todayISO()),
        fecha: todayISO(),
        origen: 'transferencia',
        movimientoId: id,
      });
    }
  });
}
