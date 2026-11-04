import { db, type NetoDB } from './db';
import type { Inversion, Suscripcion } from './types';
import { newId } from '../lib/id';
import { siguienteRenovacion, validarSuscripcion } from '../lib/subscriptions';
import { validarInversion, valorInversion } from '../lib/investments';

export async function guardarSuscripcion(datos: Omit<Suscripcion, 'id'>, id?: string, d: NetoDB = db) {
  const error = validarSuscripcion(datos); if (error) throw new Error(error);
  const clave = id ?? newId();
  await d.suscripciones.put({ ...datos, nombre: datos.nombre.trim(), categoria: datos.categoria.trim(), id: clave });
  return clave;
}
/** Avanza una sola cuota y exige la fecha que vio el usuario: evita dobles pulsaciones. */
export async function renovarSuscripcion(id: string, fechaEsperada: string, d: NetoDB = db) {
  await d.transaction('rw', d.suscripciones, async () => {
    const s = await d.suscripciones.get(id);
    if (!s || s.estado !== 'activa') throw new Error('La suscripción ya no está activa.');
    if (s.proximaFecha !== fechaEsperada) return;
    await d.suscripciones.update(id, { proximaFecha: siguienteRenovacion(s) });
  });
}
async function registrarCartera(d: NetoDB) {
  const inversiones = await d.inversiones.toArray();
  const valores = Object.fromEntries(inversiones.map(i => [i.id, valorInversion(i)]));
  const total = Object.values(valores).reduce((s, n) => s + n, 0);
  const coste = inversiones.reduce((s, i) => s + i.coste, 0);
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(coste)) throw new Error('El total supera el importe permitido.');
  const anterior = await d.historialCartera.orderBy('fecha').last();
  const fecha = new Date(Math.max(Date.now(), anterior ? Date.parse(anterior.fecha) + 1 : 0)).toISOString();
  await d.historialCartera.add({ id: newId(), fecha, total, coste, valores });
}
export async function guardarInversion(datos: Omit<Inversion, 'id'>, id?: string, d: NetoDB = db) {
  const error = validarInversion(datos); if (error) throw new Error(error);
  const clave = id ?? newId();
  await d.transaction('rw', d.inversiones, d.historialCartera, async () => {
    await d.inversiones.put({ ...datos, nombre: datos.nombre.trim(), id: clave });
    await registrarCartera(d);
  });
  return clave;
}
export async function borrarInversion(id: string, d: NetoDB = db) {
  await d.transaction('rw', d.inversiones, d.historialCartera, async () => { await d.inversiones.delete(id); await registrarCartera(d); });
}
export async function aplicarCotizaciones(precios: { id: string; precioEUR: number; fecha: string; fuente: string }[], d: NetoDB = db) {
  let actualizadas = 0;
  await d.transaction('rw', d.inversiones, d.historialCartera, async () => {
    const mapa = new Map(precios.map(p => [p.id, p]));
    for (const i of await d.inversiones.toArray()) {
      const p = i.activoId ? mapa.get(i.activoId) : undefined;
      if (!p || Date.parse(p.fecha) < Date.parse(i.precioFecha) || (p.fecha === i.precioFecha && p.precioEUR === i.precioEUR)) continue;
      const nueva = { ...i, precioEUR: p.precioEUR, precioFecha: p.fecha, fuente: p.fuente };
      const error = validarInversion(nueva); if (error) throw new Error(error);
      await d.inversiones.put(nueva); actualizadas++;
    }
    if (actualizadas) await registrarCartera(d);
  });
  return actualizadas;
}
