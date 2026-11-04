import { config } from '../config/neto.config';
import { newId } from '../lib/id';
import { db, type NetoDB } from './db';
import type { Ajustes, Categoria, Cuenta, Movimiento, TipoCategoria } from './types';

/** Operaciones de escritura. Las pantallas leen con useLiveQuery y escriben con estas funciones. */

const ahora = () => new Date().toISOString();

export const AJUSTES_POR_DEFECTO: Ajustes = { id: 'ajustes', nombre: '', autonomo: false, inicioCompletado: false };

export async function obtenerAjustes(d: NetoDB = db): Promise<Ajustes> {
  return (await d.ajustes.get('ajustes')) ?? AJUSTES_POR_DEFECTO;
}

export async function guardarAjustes(cambios: Partial<Omit<Ajustes, 'id'>>, d: NetoDB = db): Promise<void> {
  const actual = await obtenerAjustes(d);
  await d.ajustes.put({ ...actual, ...cambios, id: 'ajustes' });
}

export function categoriasIniciales(): Categoria[] {
  const lista: Categoria[] = [];
  (['gasto', 'ingreso'] as const).forEach((tipo) => {
    config.categoriasIniciales[tipo].forEach((c, i) =>
      lista.push({ id: newId(), nombre: c.nombre, color: c.color, tipo, orden: i }),
    );
  });
  return lista;
}

/** Crea las categorías iniciales si todavía no hay ninguna. */
export async function asegurarCategorias(d: NetoDB = db): Promise<void> {
  if ((await d.categorias.count()) === 0) await d.categorias.bulkAdd(categoriasIniciales());
}

export async function completarInicio(datos: { nombre: string; autonomo: boolean }, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.ajustes, d.categorias, async () => {
    await asegurarCategorias(d);
    await guardarAjustes({ ...datos, inicioCompletado: true }, d);
  });
}

// ── Cuentas ────────────────────────────────────────────────────────────────

export type DatosCuenta = Pick<Cuenta, 'nombre' | 'tipo' | 'ambito' | 'saldoInicial'>;

export async function crearCuenta(datos: DatosCuenta, d: NetoDB = db): Promise<string> {
  const id = newId();
  const orden = await d.cuentas.count();
  await d.cuentas.add({ ...datos, id, archivada: false, orden, creadaEn: ahora() });
  return id;
}

export async function actualizarCuenta(id: string, cambios: Partial<Omit<Cuenta, 'id'>>, d: NetoDB = db): Promise<void> {
  await d.cuentas.update(id, cambios);
}

export async function movimientosDeCuenta(id: string, d: NetoDB = db): Promise<number> {
  const a = await d.movimientos.where('cuentaId').equals(id).count();
  const b = await d.movimientos.where('cuentaDestinoId').equals(id).count();
  return a + b;
}

/** Solo se puede borrar una cuenta sin movimientos; si tiene, hay que archivarla. */
export async function borrarCuenta(id: string, d: NetoDB = db): Promise<void> {
  if ((await movimientosDeCuenta(id, d)) > 0) {
    throw new Error('La cuenta tiene movimientos. Archívala en lugar de borrarla.');
  }
  await d.cuentas.delete(id);
}

// ── Movimientos ────────────────────────────────────────────────────────────

export type DatosMovimiento = Pick<Movimiento, 'tipo' | 'fecha' | 'importe' | 'cuentaId' | 'cuentaDestinoId' | 'categoriaId' | 'nota'> & {
  origen?: Movimiento['origen'];
};

export function validarMovimiento(m: DatosMovimiento): string | null {
  if (!Number.isSafeInteger(m.importe) || m.importe <= 0) return 'El importe tiene que ser mayor que 0.';
  if (!m.cuentaId) return 'Elige una cuenta.';
  if (m.tipo === 'transferencia') {
    if (!m.cuentaDestinoId) return 'Elige la cuenta de destino.';
    if (m.cuentaDestinoId === m.cuentaId) return 'La cuenta de origen y la de destino deben ser distintas.';
  } else if (!m.categoriaId) {
    return 'Elige una categoría.';
  }
  return null;
}

function normalizar(m: DatosMovimiento): DatosMovimiento {
  return m.tipo === 'transferencia'
    ? { ...m, categoriaId: undefined }
    : { ...m, cuentaDestinoId: undefined };
}

export async function crearMovimiento(datos: DatosMovimiento, d: NetoDB = db): Promise<string> {
  const error = validarMovimiento(datos);
  if (error) throw new Error(error);
  const id = newId();
  const t = ahora();
  await d.movimientos.add({ ...normalizar(datos), origen: datos.origen ?? 'manual', id, nota: datos.nota.trim(), creadoEn: t, actualizadoEn: t });
  return id;
}

export async function actualizarMovimiento(id: string, datos: DatosMovimiento, d: NetoDB = db): Promise<void> {
  const error = validarMovimiento(datos);
  if (error) throw new Error(error);
  const actual = await d.movimientos.get(id);
  if (!actual) throw new Error('El movimiento ya no existe.');
  await d.movimientos.put({ ...actual, ...normalizar(datos), nota: datos.nota.trim(), actualizadoEn: ahora() });
}

export async function borrarMovimiento(id: string, d: NetoDB = db): Promise<void> {
  await d.movimientos.delete(id);
}

// ── Categorías ─────────────────────────────────────────────────────────────

export async function crearCategoria(nombre: string, tipo: TipoCategoria, color: string, d: NetoDB = db): Promise<string> {
  const id = newId();
  const orden = await d.categorias.where('tipo').equals(tipo).count();
  await d.categorias.add({ id, nombre: nombre.trim(), tipo, color, orden });
  return id;
}

export async function actualizarCategoria(id: string, cambios: Partial<Pick<Categoria, 'nombre' | 'color'>>, d: NetoDB = db): Promise<void> {
  await d.categorias.update(id, cambios);
}

/**
 * Borra una categoría y pasa sus movimientos a otra (por defecto, "Otros" / "Otros ingresos").
 * No deja borrar la última categoría de un tipo.
 */
export async function borrarCategoria(id: string, destinoId?: string, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.categorias, d.movimientos, async () => {
    const cat = await d.categorias.get(id);
    if (!cat) return;
    const hermanas = (await d.categorias.where('tipo').equals(cat.tipo).toArray()).filter((c) => c.id !== id);
    if (hermanas.length === 0) throw new Error('Tiene que quedar al menos una categoría de este tipo.');
    const porDefecto = hermanas.find((c) => c.nombre === config.categoriaPorDefecto[cat.tipo]) ?? hermanas[hermanas.length - 1];
    const destino = destinoId ?? porDefecto.id;
    await d.movimientos.where('categoriaId').equals(id).modify({ categoriaId: destino });
    await d.categorias.delete(id);
  });
}

// ── Todo ───────────────────────────────────────────────────────────────────

export async function borrarTodo(d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.tables, async () => {
    await Promise.all(d.tables.map((t) => t.clear()));
  });
}
