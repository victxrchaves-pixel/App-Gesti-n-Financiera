import { config } from '../config/neto.config';
import { colorCategoriaSugerido } from '../lib/colors';
import { isISODate, todayISO } from '../lib/dates';
import { totalesFactura, validarFactura, type DatosFactura } from '../lib/facturas';
import { newId } from '../lib/id';
import { db, type NetoDB } from './db';
import type { Cliente, Factura } from './types';

const ahora = () => new Date().toISOString();
const clave = (s: string) => s.trim().toLocaleLowerCase('es-ES');

// ── Clientes ───────────────────────────────────────────────────────────────

/** Devuelve el cliente con ese nombre (sin distinguir mayúsculas) o lo crea. Actualiza el NIF si llega uno. */
async function clientePorNombre(nombre: string, nif: string | undefined, d: NetoDB): Promise<Cliente> {
  const existente = (await d.clientes.toArray()).find((c) => clave(c.nombre) === clave(nombre));
  if (existente) {
    if (nif?.trim() && nif.trim() !== existente.nif) {
      existente.nif = nif.trim().toUpperCase();
      await d.clientes.put(existente);
    }
    return existente;
  }
  const cliente: Cliente = {
    id: newId(),
    nombre: nombre.trim(),
    nif: (nif ?? '').trim().toUpperCase(),
    creadoEn: ahora(),
  };
  await d.clientes.add(cliente);
  return cliente;
}

export async function actualizarCliente(id: string, datos: Pick<Cliente, 'nombre' | 'nif'>, d: NetoDB = db) {
  if (!datos.nombre.trim()) throw new Error('Escribe el nombre del cliente.');
  await d.transaction('rw', d.clientes, d.facturas, async () => {
    const otro = (await d.clientes.toArray()).find((c) => c.id !== id && clave(c.nombre) === clave(datos.nombre));
    if (otro) throw new Error(`Ya tienes un cliente llamado «${otro.nombre}».`);
    await d.clientes.update(id, { nombre: datos.nombre.trim(), nif: datos.nif.trim().toUpperCase() });
  });
}

/** Solo se borran clientes sin facturas, para no dejar facturas huérfanas. */
export async function borrarCliente(id: string, d: NetoDB = db) {
  await d.transaction('rw', d.clientes, d.facturas, async () => {
    const n = await d.facturas.where('clienteId').equals(id).count();
    if (n) throw new Error(n === 1 ? 'Este cliente tiene una factura.' : `Este cliente tiene ${n} facturas.`);
    await d.clientes.delete(id);
  });
}

// ── Facturas ───────────────────────────────────────────────────────────────

async function comprobarNumero(numero: string, id: string | null, d: NetoDB) {
  const repetida = (await d.facturas.toArray()).find((f) => f.id !== id && clave(f.numero) === clave(numero));
  if (repetida) throw new Error(`Ya tienes registrada la factura ${repetida.numero}.`);
}

function limpiar(datos: DatosFactura) {
  return {
    numero: datos.numero.trim(),
    fecha: datos.fecha,
    vencimiento: datos.vencimiento,
    lineas: datos.lineas.map((l) => ({ concepto: l.concepto.trim(), base: l.base, tipoIVA: l.tipoIVA })),
    retencion: datos.retencion,
    nota: datos.nota.trim(),
  };
}

export async function crearFactura(datos: DatosFactura, d: NetoDB = db): Promise<string> {
  const error = validarFactura(datos);
  if (error) throw new Error(error);
  const id = newId();
  await d.transaction('rw', d.facturas, d.clientes, async () => {
    await comprobarNumero(datos.numero, null, d);
    const cliente = await clientePorNombre(datos.clienteNombre, datos.clienteNif, d);
    const t = ahora();
    await d.facturas.add({
      ...limpiar(datos),
      id,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      cobradaEn: null,
      movimientoId: null,
      creadaEn: t,
      actualizadaEn: t,
    });
  });
  return id;
}

/** Si la factura ya está cobrada, el ingreso apuntado se ajusta al nuevo total. */
export async function actualizarFactura(id: string, datos: DatosFactura, d: NetoDB = db): Promise<void> {
  const error = validarFactura(datos);
  if (error) throw new Error(error);
  await d.transaction('rw', d.facturas, d.clientes, d.movimientos, async () => {
    const actual = await d.facturas.get(id);
    if (!actual) throw new Error('La factura ya no existe.');
    await comprobarNumero(datos.numero, id, d);
    const cliente = await clientePorNombre(datos.clienteNombre, datos.clienteNif, d);
    const nueva: Factura = {
      ...actual,
      ...limpiar(datos),
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      actualizadaEn: ahora(),
    };
    await d.facturas.put(nueva);
    if (nueva.movimientoId) {
      const total = totalesFactura(nueva.lineas, nueva.retencion).total;
      await d.movimientos.update(nueva.movimientoId, {
        importe: total,
        nota: notaCobro(nueva),
        actualizadoEn: ahora(),
      });
    }
  });
}

const notaCobro = (f: Pick<Factura, 'numero' | 'clienteNombre'>) => `Factura ${f.numero} · ${f.clienteNombre}`;

/** Categoría de ingreso donde se apuntan los cobros. Se crea la primera vez. */
/** Categoría del negocio que Neto crea la primera vez que la necesita (cobros, pagos de gastos). */
export async function asegurarCategoria(nombre: string, tipo: 'ingreso' | 'gasto', d: NetoDB): Promise<string> {
  const existente = (await d.categorias.where('tipo').equals(tipo).toArray()).find(
    (c) => clave(c.nombre) === clave(nombre),
  );
  if (existente) return existente.id;
  const id = newId();
  const orden = await d.categorias.where('tipo').equals(tipo).count();
  await d.categorias.add({ id, nombre, tipo, color: colorCategoriaSugerido(nombre), orden });
  return id;
}

const categoriaCobros = (d: NetoDB) => asegurarCategoria(config.autonomo.categoriaCobros, 'ingreso', d);

/**
 * Marca una factura como cobrada. Con «cuentaId» apunta además el ingreso (lo que paga el cliente:
 * base + IVA − retención) en esa cuenta, para que el saldo cuadre.
 */
export async function cobrarFactura(
  id: string,
  cobro: { fecha: string; cuentaId: string | null },
  d: NetoDB = db,
): Promise<void> {
  if (!isISODate(cobro.fecha) || cobro.fecha > todayISO()) throw new Error('Elige una fecha de cobro hasta hoy.');
  await d.transaction('rw', [d.facturas, d.movimientos, d.categorias, d.cuentas], async () => {
    const f = await d.facturas.get(id);
    if (!f) throw new Error('La factura ya no existe.');
    if (f.cobradaEn) throw new Error('Esta factura ya está cobrada.');
    if (cobro.fecha < f.fecha) throw new Error('El cobro no puede ser anterior a la factura.');
    let movimientoId: string | null = null;
    if (cobro.cuentaId) {
      const cuenta = await d.cuentas.get(cobro.cuentaId);
      if (!cuenta || cuenta.eliminada) throw new Error('Elige una cuenta.');
      movimientoId = newId();
      const t = ahora();
      await d.movimientos.add({
        id: movimientoId,
        tipo: 'ingreso',
        fecha: cobro.fecha,
        importe: totalesFactura(f.lineas, f.retencion).total,
        cuentaId: cobro.cuentaId,
        categoriaId: await categoriaCobros(d),
        nota: notaCobro(f),
        origen: 'factura',
        facturaId: f.id,
        creadoEn: t,
        actualizadoEn: t,
      });
    }
    await d.facturas.update(id, { cobradaEn: cobro.fecha, movimientoId, actualizadaEn: ahora() });
  });
}

/** Vuelve a dejarla pendiente y borra el ingreso que se apuntó al cobrarla. */
export async function anularCobro(id: string, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.facturas, d.movimientos, async () => {
    const f = await d.facturas.get(id);
    if (!f) throw new Error('La factura ya no existe.');
    if (f.movimientoId) await d.movimientos.delete(f.movimientoId);
    await d.facturas.update(id, { cobradaEn: null, movimientoId: null, actualizadaEn: ahora() });
  });
}

/** Borra la factura y, si se cobró en una cuenta, también ese ingreso. */
export async function borrarFactura(id: string, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.facturas, d.movimientos, async () => {
    const f = await d.facturas.get(id);
    if (!f) return;
    if (f.movimientoId) await d.movimientos.delete(f.movimientoId);
    await d.facturas.delete(id);
  });
}
