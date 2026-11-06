import { dineroMeta } from '../lib/goalMoney';
import { validarDesglose } from '../lib/tripBreakdown';
import { saldosDirectos, saldoParaReservar } from '../lib/balances';
import { crearBolsilloMeta } from './savings';
import { crearMovimiento } from './repo';
import { db, type NetoDB } from './db';
import type { AporteMeta, Meta, PartidaViaje } from './types';
import { newId } from '../lib/id';
import { monthKey, todayISO, isISODate } from '../lib/dates';
import { mesValido } from '../lib/budgets';
import { esColor } from '../lib/colors';

export function validarMeta(m: Omit<Meta, 'id'>) {
  if (typeof m.nombre !== 'string' || !m.nombre.trim() || m.nombre.length > 80)
    return 'Pon un nombre de hasta 80 caracteres.';
  if (
    ![m.objetivo, m.inicial, m.mensual].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    m.objetivo <= 0 ||
    !Number.isSafeInteger(m.inicial + m.mensual)
  )
    return 'Introduce importes válidos y un objetivo mayor que cero.';
  if (typeof m.mesInicio !== 'string' || !mesValido(m.mesInicio) || m.mesInicio < '2000-01')
    return 'Elige un mes de inicio válido desde el año 2000.';
  if (typeof m.automatica !== 'boolean' || typeof m.activa !== 'boolean') return 'El modo de aportación no es válido.';
  if (m.pausadaDesde != null && (typeof m.pausadaDesde !== 'string' || !mesValido(m.pausadaDesde)))
    return 'La fecha de pausa no es válida.';
  if (m.cuentaAhorroId != null && (typeof m.cuentaAhorroId !== 'string' || !m.cuentaAhorroId))
    return 'La cuenta de ahorro no es válida.';
  if (m.categoriaAhorro != null && !['ahorro', 'viajes', 'otros'].includes(m.categoriaAhorro))
    return 'El tipo de ahorro no es válido.';
  if (m.cuentaOrigenId != null && (typeof m.cuentaOrigenId !== 'string' || !m.cuentaOrigenId))
    return 'Elige una cuenta de origen válida.';
  if (
    m.porcentaje != null &&
    (!Number.isFinite(m.porcentaje) ||
      m.porcentaje < 0 ||
      m.porcentaje > 100 ||
      !Number.isSafeInteger(m.baseMensual) ||
      m.baseMensual! <= 0)
  )
    return 'El porcentaje debe estar entre 0 y 100 y tener un ingreso de referencia positivo.';
  if (m.color != null && !esColor(m.color)) return 'El color no es válido.';
  return validarDesglose(m.desglose, m.objetivo);
}
export function validarAporte(a: Omit<AporteMeta, 'id'>) {
  return (
    typeof a.metaId === 'string' &&
    !!a.metaId &&
    typeof a.mes === 'string' &&
    mesValido(a.mes) &&
    Number.isSafeInteger(a.importe) &&
    a.importe >= 0 &&
    ['plan', 'confirmado', 'transferencia'].includes(a.origen) &&
    (a.fecha == null || (isISODate(a.fecha) && a.fecha <= todayISO())) &&
    (a.origen !== 'transferencia' || (typeof a.movimientoId === 'string' && !!a.movimientoId))
  );
}
/** Solo registra la cuota del mes actual; los atrasos requieren confirmación expresa. */
export async function sincronizarMetas(hasta = monthKey(todayISO()), d: NetoDB = db) {
  if (!mesValido(hasta)) throw new Error('Mes no válido.');
  await d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => {
    const movimientos = await d.movimientos.toArray();
    const mapa = new Map(movimientos.map((m) => [m.id, m]));
    const grupos = new Map<string, AporteMeta[]>();
    for (const a of await d.aportesMetas.toArray())
      if (a.origen === 'transferencia' && a.movimientoId)
        grupos.set(a.movimientoId, [...(grupos.get(a.movimientoId) ?? []), a]);
    for (const [id, filas] of grupos) {
      const mov = mapa.get(id);
      const meta = await d.metas.get(filas[0].metaId);
      const total =
        mov?.tipo === 'transferencia' && mov.cuentaDestinoId === meta?.cuentaAhorroId && mov.fecha <= todayISO()
          ? mov.importe
          : 0;
      const antes = filas.reduce((s, a) => s + a.importe, 0);
      if (total === antes) continue;
      let repartido = 0;
      for (let i = 0; i < filas.length; i++) {
        const importe =
          i === filas.length - 1
            ? total - repartido
            : Math.floor(total * (antes ? filas[i].importe / antes : 1 / filas.length));
        repartido += importe;
        await d.aportesMetas.update(filas[i].id, { importe });
      }
    }
    const actual = monthKey(todayISO());
    if (hasta !== actual) return;
    for (const m of await d.metas.toArray()) {
      if (!m.activa || !m.automatica || !m.cuentaOrigenId || m.mesInicio > actual) continue;
      const aportes = await d.aportesMetas.where('metaId').equals(m.id).toArray();
      if (aportes.some((a) => a.mes === actual && a.origen !== 'plan')) continue;
      const cuentas = await d.cuentas.toArray();
      const movs = await d.movimientos.toArray();
      const origen = cuentas.find(
        (c) => c.id === m.cuentaOrigenId && !c.eliminada && !c.archivada && c.ambito === 'personal',
      );
      const destino = cuentas.find((c) => c.id === m.cuentaAhorroId && !c.eliminada && !c.archivada);
      const estado = dineroMeta(m, aportes, cuentas, movs);
      const importe = Math.max(0, Math.min(m.mensual, m.objetivo - estado.progreso));
      if (!origen || !destino || !importe || saldoParaReservar(origen.id, cuentas, movs) < importe) continue;
      await aportarMeta(m.id, importe, [actual], todayISO(), `cuota:${m.id}:${actual}`, d);
    }
  });
}
export async function guardarMeta(datos: Omit<Meta, 'id'>, id?: string, d: NetoDB = db) {
  if (datos.porcentaje != null && Number.isFinite(datos.porcentaje) && Number.isSafeInteger(datos.baseMensual))
    datos = { ...datos, mensual: Math.round((datos.baseMensual! * datos.porcentaje) / 100) };
  const error = validarMeta(datos);
  if (error) throw new Error(error);
  const clave = id ?? newId();
  await d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => {
    const anterior = id ? await d.metas.get(id) : undefined;
    if (id && !anterior) throw new Error('La meta ya no existe.');
    const desglose = datos.desglose ?? anterior?.desglose;
    const errorDesglose = validarDesglose(desglose, datos.objetivo);
    if (errorDesglose) throw new Error(errorDesglose);
    const aportes = await d.aportesMetas.where('metaId').equals(clave).toArray();
    if (!Number.isSafeInteger(aportes.reduce((s, a) => s + a.importe, datos.inicial)))
      throw new Error('El total supera el importe permitido.');
    const ahora = monthKey(todayISO());
    if (datos.cuentaOrigenId && !anterior?.cuentaOrigenId) {
      const planActual = aportes.find((a) => a.mes === ahora && a.origen === 'plan');
      if (planActual) await d.aportesMetas.delete(planActual.id);
    }
    const pausadaDesde = !datos.activa ? (anterior?.pausadaDesde ?? ahora) : null;
    let cuentaAhorroId = anterior?.cuentaAhorroId ?? null;
    if (datos.cuentaOrigenId) {
      const origen = await d.cuentas.get(datos.cuentaOrigenId);
      if (
        !origen ||
        origen.eliminada ||
        origen.archivada ||
        origen.ambito !== 'personal' ||
        datos.cuentaOrigenId === cuentaAhorroId
      )
        throw new Error('Elige una cuenta personal de origen disponible, distinta del ahorro de la meta.');
      if (!cuentaAhorroId) cuentaAhorroId = await crearBolsilloMeta(clave, datos.nombre, d);
    }
    await d.metas.put({
      ...datos,
      ...(desglose ? { desglose } : {}),
      cuentaAhorroId,
      pausadaDesde,
      nombre: datos.nombre.trim(),
      id: clave,
    });
    await sincronizarMetas(undefined, d);
  });
  return clave;
}
export async function borrarMeta(id: string, d: NetoDB = db) {
  await d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => {
    const meta = await d.metas.get(id);
    const bolsillo = meta?.cuentaAhorroId ? await d.cuentas.get(meta.cuentaAhorroId) : undefined;
    if (bolsillo?.cuentaPadreId && !bolsillo.eliminada && !bolsillo.archivada) {
      const padre = await d.cuentas.get(bolsillo.cuentaPadreId);
      if (padre && !padre.eliminada && !padre.archivada) {
        const saldo = saldosDirectos(await d.cuentas.toArray(), await d.movimientos.toArray()).get(bolsillo.id) ?? 0;
        if (saldo)
          await crearMovimiento(
            {
              tipo: 'transferencia',
              fecha: todayISO(),
              importe: Math.abs(saldo),
              cuentaId: saldo > 0 ? bolsillo.id : padre.id,
              cuentaDestinoId: saldo > 0 ? padre.id : bolsillo.id,
              nota: `Ahorro liberado al eliminar ${meta!.nombre}`,
            },
            d,
          );
        await d.cuentas.update(bolsillo.id, { eliminada: true });
      }
    }
    await d.aportesMetas.where('metaId').equals(id).delete();
    await d.metas.delete(id);
  });
}

/** Solo cambia la planificación del viaje; no genera aportaciones ni movimientos. */
export async function guardarDesglose(metaId: string, partidas: PartidaViaje[], d: NetoDB = db) {
  await d.transaction('rw', d.metas, async () => {
    const meta = await d.metas.get(metaId);
    if (!meta) throw new Error('La meta ya no existe.');
    const error = validarDesglose(partidas, meta.objetivo);
    if (error) throw new Error(error);
    await d.metas.update(metaId, {
      desglose: partidas.map((p) => ({ id: p.id, nombre: p.nombre.trim(), importe: p.importe })),
    });
  });
}

/** Una transferencia real puede repartirse entre varios meses, sin repetirla. */
export async function aportarMeta(
  metaId: string,
  importe: number,
  meses: string[],
  fecha: string,
  grupoId: string,
  d: NetoDB = db,
) {
  if (
    !Number.isSafeInteger(importe) ||
    importe <= 0 ||
    !isISODate(fecha) ||
    fecha > todayISO() ||
    !grupoId ||
    grupoId.length > 160 ||
    !Array.isArray(meses) ||
    !meses.length ||
    meses.length > 24 ||
    new Set(meses).size !== meses.length ||
    meses.some((m) => !mesValido(m) || m < '2000-01')
  )
    throw new Error('Revisa el importe real, la fecha y los meses del reparto.');
  return d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => {
    if (await d.aportesMetas.where('grupoId').equals(grupoId).count()) return;
    const meta = await d.metas.get(metaId);
    if (!meta) throw new Error('La meta ya no existe.');
    const previos = await d.aportesMetas.where('metaId').equals(metaId).toArray();
    if (
      !Number.isSafeInteger(
        previos.filter((a) => a.origen !== 'plan').reduce((s, a) => s + a.importe, meta.inicial + importe),
      )
    )
      throw new Error('El total supera el importe permitido.');
    let movimientoId: string | undefined;
    if (meta.cuentaOrigenId) {
      const cuentas = await d.cuentas.toArray();
      const origen = cuentas.find((c) => c.id === meta.cuentaOrigenId && !c.eliminada && !c.archivada);
      const destino = cuentas.find((c) => c.id === meta.cuentaAhorroId && !c.eliminada && !c.archivada);
      if (!origen || !destino || saldoParaReservar(origen.id, cuentas, await d.movimientos.toArray()) < importe)
        throw new Error('No hay saldo disponible suficiente en la cuenta de origen.');
      movimientoId = await crearMovimiento(
        {
          tipo: 'transferencia',
          cuentaId: origen.id,
          cuentaDestinoId: destino.id,
          fecha,
          importe,
          nota: `Aportación a ${meta.nombre} · ${meses.join(', ')}`,
          origen: 'manual',
        },
        d,
      );
    }
    const base = Math.floor(importe / meses.length),
      resto = importe % meses.length;
    for (let i = 0; i < meses.length; i++) {
      for (const a of previos.filter((a) => a.mes === meses[i] && a.origen === 'plan'))
        await d.aportesMetas.delete(a.id);
      await d.aportesMetas.add({
        id: newId(),
        grupoId,
        metaId,
        mes: meses[i],
        fecha,
        importe: base + (i < resto ? 1 : 0),
        origen: movimientoId ? 'transferencia' : 'confirmado',
        ...(movimientoId ? { movimientoId } : {}),
      });
    }
  });
}
export async function gastarMeta(
  datos: {
    metaId: string;
    partidaId?: string;
    importe: number;
    fecha: string;
    categoriaId: string;
    nota: string;
    operacionId: string;
  },
  d: NetoDB = db,
) {
  return d.transaction('rw', d.metas, d.cuentas, d.movimientos, d.categorias, async () => {
    if (await d.movimientos.where('operacionId').equals(datos.operacionId).count()) return;
    const meta = await d.metas.get(datos.metaId);
    if (!meta) throw new Error('La meta ya no existe.');
    if (
      !Number.isSafeInteger(datos.importe) ||
      datos.importe <= 0 ||
      !isISODate(datos.fecha) ||
      datos.fecha > todayISO() ||
      !datos.operacionId
    )
      throw new Error('Registra un gasto real con fecha hasta hoy.');
    if (datos.partidaId && !meta.desglose?.some((p) => p.id === datos.partidaId))
      throw new Error('El concepto del viaje ya no existe.');
    const cuenta = meta.cuentaAhorroId ? await d.cuentas.get(meta.cuentaAhorroId) : undefined;
    if (
      !cuenta ||
      cuenta.eliminada ||
      cuenta.archivada ||
      (saldosDirectos(await d.cuentas.toArray(), await d.movimientos.toArray()).get(cuenta.id) ?? 0) < datos.importe
    )
      throw new Error('La cuenta de ahorro no tiene saldo disponible suficiente.');
    if ((await d.categorias.get(datos.categoriaId))?.tipo !== 'gasto') throw new Error('Elige una categoría de gasto.');
    const id = await crearMovimiento(
      {
        tipo: 'gasto',
        cuentaId: cuenta.id,
        importe: datos.importe,
        fecha: datos.fecha,
        categoriaId: datos.categoriaId,
        nota: datos.nota.trim() || `Gasto de ${meta.nombre}`,
      },
      d,
    );
    await d.movimientos.update(id, {
      metaId: meta.id,
      partidaViajeId: datos.partidaId,
      operacionId: datos.operacionId,
    });
  });
}
export async function reasignarAhorro(
  datos: {
    metaId: string;
    destinoMetaId?: string;
    cuentaDestinoId?: string;
    importe: number;
    fecha: string;
    operacionId: string;
  },
  d: NetoDB = db,
) {
  return d.transaction('rw', d.metas, d.aportesMetas, d.cuentas, d.movimientos, async () => {
    if (await d.movimientos.where('operacionId').equals(datos.operacionId).count()) return;
    const meta = await d.metas.get(datos.metaId);
    if (!meta) throw new Error('La meta ya no existe.');
    if (
      !Number.isSafeInteger(datos.importe) ||
      datos.importe <= 0 ||
      !isISODate(datos.fecha) ||
      datos.fecha > todayISO() ||
      !datos.operacionId
    )
      throw new Error('Revisa el importe y la fecha del traspaso.');
    const origen = meta.cuentaAhorroId ? await d.cuentas.get(meta.cuentaAhorroId) : undefined;
    if (
      !origen ||
      origen.eliminada ||
      origen.archivada ||
      (saldosDirectos(await d.cuentas.toArray(), await d.movimientos.toArray()).get(origen.id) ?? 0) < datos.importe
    )
      throw new Error('No hay suficiente dinero restante en la meta.');
    let destinoMeta = datos.destinoMetaId ? await d.metas.get(datos.destinoMetaId) : undefined;
    if (datos.destinoMetaId && (!destinoMeta || destinoMeta.id === meta.id))
      throw new Error('Elige otra meta de destino.');
    let cuentaDestinoId = datos.cuentaDestinoId;
    if (destinoMeta) {
      if (!destinoMeta.cuentaAhorroId) {
        const id = await crearBolsilloMeta(destinoMeta.id, destinoMeta.nombre, d);
        await d.metas.update(destinoMeta.id, { cuentaAhorroId: id });
        destinoMeta = { ...destinoMeta, cuentaAhorroId: id };
      }
      cuentaDestinoId = destinoMeta.cuentaAhorroId!;
    }
    const destino = cuentaDestinoId ? await d.cuentas.get(cuentaDestinoId) : undefined;
    if (!destino || destino.eliminada || destino.archivada || destino.ambito !== 'personal' || destino.id === origen.id)
      throw new Error('Elige una cuenta personal de destino disponible.');
    const id = await crearMovimiento(
      {
        tipo: 'transferencia',
        cuentaId: origen.id,
        cuentaDestinoId: destino.id,
        importe: datos.importe,
        fecha: datos.fecha,
        nota: `Reparto de ${meta.nombre}${destinoMeta ? ` a ${destinoMeta.nombre}` : ' a disponible'}`,
      },
      d,
    );
    await d.movimientos.update(id, { operacionId: datos.operacionId });
    if (destinoMeta)
      await d.aportesMetas.add({
        id: newId(),
        grupoId: datos.operacionId,
        metaId: destinoMeta.id,
        mes: monthKey(datos.fecha),
        fecha: datos.fecha,
        importe: datos.importe,
        origen: 'transferencia',
        movimientoId: id,
      });
  });
}
