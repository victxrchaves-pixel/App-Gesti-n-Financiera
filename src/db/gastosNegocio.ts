import { config } from '../config/neto.config';
import { todayISO } from '../lib/dates';
import { cifrasGasto, validarGastoNegocio, type DatosGastoNegocio } from '../lib/gastosNegocio';
import { newId } from '../lib/id';
import { db, type NetoDB } from './db';
import { asegurarCategoria } from './facturas';
import type { GastoNegocio } from './types';

const ahora = () => new Date().toISOString();
const notaPago = (g: Pick<GastoNegocio, 'proveedor' | 'concepto'>) =>
  [g.proveedor.trim(), g.concepto.trim()].filter(Boolean).join(' · ');

function limpiar(datos: DatosGastoNegocio) {
  return {
    ...datos,
    proveedor: datos.proveedor.trim(),
    numero: datos.numero.trim(),
    concepto: datos.concepto.trim(),
    nota: datos.nota.trim(),
  };
}

async function comprobarCuenta(datos: DatosGastoNegocio, d: NetoDB) {
  if (!datos.cuentaId) return;
  const cuenta = await d.cuentas.get(datos.cuentaId);
  if (!cuenta || cuenta.eliminada) throw new Error('Elige una cuenta.');
  if (datos.fecha > todayISO())
    throw new Error('Para apuntar el pago en una cuenta, la fecha tiene que ser de hoy o antes.');
}

/**
 * Apunta, ajusta o quita el pago del gasto en su cuenta para que el saldo cuadre con el banco.
 * Devuelve el id del movimiento (o null si no se apunta en ninguna cuenta).
 */
async function sincronizarPago(g: GastoNegocio, d: NetoDB): Promise<string | null> {
  if (!g.cuentaId) {
    if (g.movimientoId) await d.movimientos.delete(g.movimientoId);
    return null;
  }
  const datos = {
    tipo: 'gasto' as const,
    fecha: g.fecha,
    importe: cifrasGasto(g).total,
    cuentaId: g.cuentaId,
    nota: notaPago(g),
    actualizadoEn: ahora(),
  };
  if (g.movimientoId && (await d.movimientos.get(g.movimientoId))) {
    await d.movimientos.update(g.movimientoId, datos);
    return g.movimientoId;
  }
  const id = newId();
  await d.movimientos.add({
    ...datos,
    id,
    categoriaId: await asegurarCategoria(config.autonomo.categoriaPagos, 'gasto', d),
    origen: 'gasto-negocio',
    gastoNegocioId: g.id,
    creadoEn: ahora(),
  });
  return id;
}

export async function crearGastoNegocio(datos: DatosGastoNegocio, d: NetoDB = db): Promise<string> {
  const error = validarGastoNegocio(datos);
  if (error) throw new Error(error);
  const id = newId();
  await d.transaction('rw', [d.gastosNegocio, d.movimientos, d.categorias, d.cuentas], async () => {
    await comprobarCuenta(datos, d);
    const t = ahora();
    const gasto: GastoNegocio = { ...limpiar(datos), id, movimientoId: null, creadoEn: t, actualizadoEn: t };
    gasto.movimientoId = await sincronizarPago(gasto, d);
    await d.gastosNegocio.add(gasto);
  });
  return id;
}

export async function actualizarGastoNegocio(id: string, datos: DatosGastoNegocio, d: NetoDB = db): Promise<void> {
  const error = validarGastoNegocio(datos);
  if (error) throw new Error(error);
  await d.transaction('rw', [d.gastosNegocio, d.movimientos, d.categorias, d.cuentas], async () => {
    const actual = await d.gastosNegocio.get(id);
    if (!actual) throw new Error('El gasto ya no existe.');
    await comprobarCuenta(datos, d);
    const gasto: GastoNegocio = { ...actual, ...limpiar(datos), actualizadoEn: ahora() };
    gasto.movimientoId = await sincronizarPago(gasto, d);
    await d.gastosNegocio.put(gasto);
  });
}

/** Borra el gasto y, si se apuntó su pago, también ese movimiento. */
export async function borrarGastoNegocio(id: string, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.gastosNegocio, d.movimientos, async () => {
    const g = await d.gastosNegocio.get(id);
    if (!g) return;
    if (g.movimientoId) await d.movimientos.delete(g.movimientoId);
    await d.gastosNegocio.delete(id);
  });
}
