import { db, type NetoDB } from './db';
import type { Presupuesto } from './types';
import { mesValido, validarPresupuesto } from '../lib/budgets';
import { newId } from '../lib/id';

/** Prepara cada mes una sola vez. Un plan vacío es intencionado y nunca recupera límites borrados. */
export async function asegurarPlanMes(mes: string, d: NetoDB = db) {
  if (!mesValido(mes)) throw new Error('Elige un mes válido.');
  return d.transaction('rw', d.planesMes, d.presupuestos, d.categorias, async () => {
    const existente = await d.planesMes.get(mes);
    if (existente) return existente;
    const presupuestos = await d.presupuestos.toArray(),
      planes = await d.planesMes.toArray();
    const anterior = [...new Set([...presupuestos.map((p) => p.mes), ...planes.map((p) => p.id)])]
      .filter((m) => m < mes)
      .sort()
      .at(-1);
    if (anterior) await copiarPresupuestos(anterior, mes, d);
    const plan = { id: mes, repetidoDe: anterior, revisado: !anterior };
    await d.planesMes.add(plan);
    return plan;
  });
}

export async function guardarPresupuesto(datos: Omit<Presupuesto, 'id'>, id?: string, d: NetoDB = db) {
  const error = validarPresupuesto(datos);
  if (error) throw new Error(error);
  return d.transaction('rw', d.presupuestos, d.categorias, async () => {
    if ((await d.categorias.get(datos.categoriaId))?.tipo !== 'gasto')
      throw new Error('La categoría de gasto ya no existe.');
    if (id && !(await d.presupuestos.get(id))) throw new Error('El presupuesto ya no existe.');
    const duplicado = await d.presupuestos.where('[mes+categoriaId]').equals([datos.mes, datos.categoriaId]).first();
    if (duplicado && duplicado.id !== id)
      throw new Error('Esta categoría ya tiene un presupuesto para ese mes. Edítalo desde su tarjeta.');
    const otros = (await d.presupuestos.where('mes').equals(datos.mes).toArray()).filter((p) => p.id !== id);
    if (!Number.isSafeInteger(otros.reduce((s, p) => s + p.limite, datos.limite)))
      throw new Error('El total supera el importe permitido.');
    const clave = id ?? newId();
    await d.presupuestos.put({ ...datos, id: clave });
    return clave;
  });
}
export async function borrarPresupuesto(id: string, d: NetoDB = db) {
  await d.presupuestos.delete(id);
}
/** Copia solo límites ausentes; nunca movimientos ni presupuestos existentes. */
export async function copiarPresupuestos(origen: string, destino: string, d: NetoDB = db) {
  if (!mesValido(origen) || !mesValido(destino) || origen === destino)
    throw new Error('Elige dos meses distintos y válidos.');
  return d.transaction('rw', d.presupuestos, d.categorias, async () => {
    const existentes = await d.presupuestos.where('mes').equals(destino).toArray();
    const usados = new Set(existentes.map((p) => p.categoriaId));
    const categorias = new Set((await d.categorias.where('tipo').equals('gasto').toArray()).map((c) => c.id));
    const nuevos = (await d.presupuestos.where('mes').equals(origen).toArray())
      .filter((p) => !usados.has(p.categoriaId) && categorias.has(p.categoriaId))
      .map((p) => ({ ...p, id: newId(), mes: destino }));
    if (!Number.isSafeInteger([...existentes, ...nuevos].reduce((s, p) => s + p.limite, 0)))
      throw new Error('El total supera el importe permitido.');
    await d.presupuestos.bulkAdd(nuevos);
    return nuevos.length;
  });
}

/**
 * Crea el presupuesto de un mes a partir del reparto por porcentajes. Sustituye los límites
 * que hubiera ese mes (conserva el color propio de cada uno) y no toca ningún movimiento.
 */
export async function aplicarPlanPorcentajes(
  mes: string,
  limites: { categoriaId: string; limite: number }[],
  d: NetoDB = db,
) {
  if (!mesValido(mes)) throw new Error('Elige un mes válido.');
  if (!limites.length) throw new Error('Pon un porcentaje al menos a una categoría.');
  for (const l of limites)
    if (!Number.isSafeInteger(l.limite) || l.limite <= 0) throw new Error('Hay un límite no válido.');
  await asegurarPlanMes(mes, d);
  return d.transaction('rw', d.presupuestos, d.categorias, d.planesMes, async () => {
    const deGasto = new Set((await d.categorias.where('tipo').equals('gasto').toArray()).map((c) => c.id));
    if (limites.some((l) => !deGasto.has(l.categoriaId))) throw new Error('Alguna categoría de gasto ya no existe.');
    const existentes = await d.presupuestos.where('mes').equals(mes).toArray();
    const anterior = new Map(existentes.map((p) => [p.categoriaId, p]));
    const nuevas = new Set(limites.map((l) => l.categoriaId));
    await d.presupuestos.bulkDelete(existentes.filter((p) => !nuevas.has(p.categoriaId)).map((p) => p.id));
    for (const l of limites) {
      const previo = anterior.get(l.categoriaId);
      await d.presupuestos.put({
        id: previo?.id ?? newId(),
        mes,
        categoriaId: l.categoriaId,
        limite: l.limite,
        color: previo?.color ?? null,
      });
    }
    await d.planesMes.update(mes, { revisado: true });
    return limites.length;
  });
}
