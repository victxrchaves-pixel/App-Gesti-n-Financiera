import { validarReparto } from '../lib/movements';
import { perfilNegocio, validarPerfilNegocio } from '../lib/facturas';
import { isISODate, todayISO } from '../lib/dates';
import { CAMPOS_COLOR, esColor } from '../lib/colors';
import { config } from '../config/neto.config';
import { newId } from '../lib/id';
import { db, type NetoDB } from './db';
import type { Ajustes, Categoria, Cuenta, Movimiento, PerfilNegocio, TipoCategoria } from './types';

/** Operaciones de escritura. Las pantallas leen con useLiveQuery y escriben con estas funciones. */

const ahora = () => new Date().toISOString();

export const AJUSTES_POR_DEFECTO: Ajustes = { id: 'ajustes', nombre: '', autonomo: false, inicioCompletado: false };

export async function obtenerAjustes(d: NetoDB = db): Promise<Ajustes> {
  return (await d.ajustes.get('ajustes')) ?? AJUSTES_POR_DEFECTO;
}

export async function guardarAjustes(cambios: Partial<Omit<Ajustes, 'id'>>, d: NetoDB = db): Promise<void> {
  for (const campo of CAMPOS_COLOR)
    if (cambios[campo] != null && !esColor(cambios[campo]))
      throw new Error('Color no válido. Usa un código hexadecimal como #336699.');
  if (cambios.negocio) {
    const error = validarPerfilNegocio(cambios.negocio);
    if (error) throw new Error(error);
  }
  await d.transaction('rw', d.ajustes, async () => {
    const actual = await obtenerAjustes(d);
    await d.ajustes.put({ ...actual, ...cambios, id: 'ajustes' });
  });
}

/**
 * Cambia solo los campos indicados del perfil fiscal. Lee y escribe en la misma transacción para que
 * dos cambios seguidos (un interruptor y una fecha) no se pisen.
 */
export async function guardarPerfilNegocio(cambios: Partial<PerfilNegocio>, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.ajustes, async () => {
    const actual = await obtenerAjustes(d);
    const negocio = { ...perfilNegocio(actual.negocio), ...cambios };
    const error = validarPerfilNegocio(negocio);
    if (error) throw new Error(error);
    await d.ajustes.put({ ...actual, negocio, id: 'ajustes' });
  });
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
  return d.transaction('rw', d.cuentas, async () => {
    if (
      datos.tipo === 'ahorro' &&
      datos.ambito === 'personal' &&
      (await d.cuentas.filter((c) => !!c.ahorroGeneral && !c.eliminada && !c.archivada).count())
    )
      throw new Error('Ya tienes una cuenta general de ahorro. Edítala desde Cuentas o crea una meta dentro de ella.');
    const id = newId();
    const orden = await d.cuentas.count();
    await d.cuentas.add({
      ...datos,
      id,
      archivada: false,
      orden,
      creadaEn: ahora(),
      ...(datos.tipo === 'ahorro' && datos.ambito === 'personal' ? { ahorroGeneral: true } : {}),
    });
    return id;
  });
}

export async function actualizarCuenta(
  id: string,
  cambios: Partial<Omit<Cuenta, 'id'>>,
  d: NetoDB = db,
): Promise<void> {
  if (cambios.archivada) throw new Error('Las cuentas no se archivan. Puedes eliminarlas.');
  await d.transaction('rw', d.cuentas, async () => {
    const actual = await d.cuentas.get(id);
    if (
      actual?.ahorroGeneral &&
      ((cambios.tipo && cambios.tipo !== 'ahorro') || (cambios.ambito && cambios.ambito !== 'personal'))
    )
      throw new Error('La cuenta general mantiene el ahorro personal y sus metas.');
    const siguiente = actual ? { ...actual, ...cambios } : undefined;
    if (
      siguiente?.tipo === 'ahorro' &&
      siguiente.ambito === 'personal' &&
      !siguiente.cuentaPadreId &&
      !siguiente.eliminada
    ) {
      if (await d.cuentas.filter((c) => c.id !== id && !!c.ahorroGeneral && !c.eliminada && !c.archivada).count())
        throw new Error(
          'Ya tienes una cuenta general de ahorro. Edítala desde Cuentas o crea una meta dentro de ella.',
        );
      cambios = { ...cambios, ahorroGeneral: true };
    }
    await d.cuentas.update(id, cambios);
  });
}

export async function movimientosDeCuenta(id: string, d: NetoDB = db): Promise<number> {
  const a = await d.movimientos.where('cuentaId').equals(id).count();
  const b = await d.movimientos.where('cuentaDestinoId').equals(id).count();
  return a + b;
}

/** Elimina la cuenta de todas las vistas; conserva referencias para el historial. */
export async function borrarCuenta(id: string, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.cuentas, d.metas, async () => {
    const ids = new Set([id, ...(await d.cuentas.filter((c) => c.cuentaPadreId === id).toArray()).map((c) => c.id)]);
    await d.cuentas
      .where('id')
      .anyOf([...ids])
      .modify({ eliminada: true, archivada: false });
    await d.metas
      .filter((m) => ids.has(m.cuentaOrigenId ?? '') || ids.has(m.cuentaAhorroId ?? ''))
      .modify({ activa: false });
  });
}

// ── Movimientos ────────────────────────────────────────────────────────────

export type DatosMovimiento = Pick<
  Movimiento,
  'tipo' | 'fecha' | 'importe' | 'cuentaId' | 'cuentaDestinoId' | 'categoriaId' | 'nota'
> & {
  origen?: Movimiento['origen'];
  reparto?: Movimiento['reparto'];
};

export function validarMovimiento(m: DatosMovimiento): string | null {
  if (!['ingreso', 'gasto', 'transferencia'].includes(m.tipo)) return 'El tipo de movimiento no es válido.';
  if (typeof m.fecha !== 'string' || !isISODate(m.fecha) || m.fecha > todayISO())
    return 'Registra únicamente movimientos ya realizados, con fecha hasta hoy.';
  if (!Number.isSafeInteger(m.importe) || m.importe <= 0) return 'El importe tiene que ser mayor que 0.';
  if (!m.cuentaId) return 'Elige una cuenta.';
  if (m.tipo === 'transferencia') {
    if (!m.cuentaDestinoId) return 'Elige la cuenta de destino.';
    if (m.cuentaDestinoId === m.cuentaId) return 'La cuenta de origen y la de destino deben ser distintas.';
  } else if (!m.categoriaId) {
    return 'Elige una categoría.';
  }
  return validarReparto(m);
}

function normalizar(m: DatosMovimiento): DatosMovimiento {
  return m.tipo === 'transferencia'
    ? { ...m, categoriaId: undefined, reparto: undefined }
    : { ...m, cuentaDestinoId: undefined, reparto: m.reparto };
}

export async function crearMovimiento(datos: DatosMovimiento, d: NetoDB = db): Promise<string> {
  const error = validarMovimiento(datos);
  if (error) throw new Error(error);
  if (datos.reparto)
    for (const parte of datos.reparto)
      if ((await d.categorias.get(parte.categoriaId))?.tipo !== datos.tipo)
        throw new Error('El reparto usa una categoría del tipo incorrecto.');
  const id = newId();
  const t = ahora();
  await d.movimientos.add({
    ...normalizar(datos),
    origen: datos.origen ?? 'manual',
    id,
    nota: datos.nota.trim(),
    creadoEn: t,
    actualizadoEn: t,
  });
  return id;
}

export async function actualizarMovimiento(id: string, datos: DatosMovimiento, d: NetoDB = db): Promise<void> {
  const error = validarMovimiento(datos);
  if (error) throw new Error(error);
  await d.transaction('rw', d.movimientos, d.categorias, async () => {
    const actual = await d.movimientos.get(id);
    if (!actual) throw new Error('El movimiento ya no existe.');
    if (actual.devolucionDe) throw new Error('Anula esta devolución y vuelve a registrarla con los datos correctos.');
    if (await d.movimientos.filter((m) => m.devolucionDe === id).count())
      throw new Error('Anula primero las devoluciones vinculadas antes de modificar el gasto original.');
    if (datos.reparto)
      for (const parte of datos.reparto)
        if ((await d.categorias.get(parte.categoriaId))?.tipo !== datos.tipo)
          throw new Error('El reparto usa una categoría del tipo incorrecto.');
    await d.movimientos.put({ ...actual, ...normalizar(datos), nota: datos.nota.trim(), actualizadoEn: ahora() });
  });
}

export async function borrarMovimiento(id: string, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', [d.movimientos, d.facturas, d.gastosNegocio], async () => {
    if (await d.movimientos.filter((m) => m.devolucionDe === id).count())
      throw new Error('Anula primero las devoluciones vinculadas antes de borrar el gasto original.');
    const m = await d.movimientos.get(id);
    await d.movimientos.delete(id);
    // El cobro de una factura o el pago de un gasto del negocio dejan de estar apuntados en la cuenta,
    // pero la factura sigue cobrada y el gasto sigue registrado.
    if (m?.facturaId) await d.facturas.update(m.facturaId, { movimientoId: null });
    if (m?.gastoNegocioId) await d.gastosNegocio.update(m.gastoNegocioId, { movimientoId: null, cuentaId: null });
  });
}

// ── Categorías ─────────────────────────────────────────────────────────────

export async function crearCategoria(
  nombre: string,
  tipo: TipoCategoria,
  color: string,
  d: NetoDB = db,
): Promise<string> {
  if (!esColor(color)) throw new Error('Color no válido.');
  const id = newId();
  const orden = await d.categorias.where('tipo').equals(tipo).count();
  await d.categorias.add({ id, nombre: nombre.trim(), tipo, color, orden });
  return id;
}

export async function actualizarCategoria(
  id: string,
  cambios: Partial<Pick<Categoria, 'nombre' | 'color' | 'icono'>>,
  d: NetoDB = db,
): Promise<void> {
  if (cambios.color !== undefined && !esColor(cambios.color)) throw new Error('Color no válido.');
  await d.categorias.update(id, cambios);
}

/**
 * Borra una categoría y pasa sus movimientos a otra (por defecto, "Otros" / "Otros ingresos").
 * No deja borrar la última categoría de un tipo.
 */
export async function borrarCategoria(id: string, destinoId?: string, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.categorias, d.movimientos, d.presupuestos, d.pagosFijos, async () => {
    const cat = await d.categorias.get(id);
    if (!cat) return;
    const hermanas = (await d.categorias.where('tipo').equals(cat.tipo).toArray()).filter((c) => c.id !== id);
    if (hermanas.length === 0) throw new Error('Tiene que quedar al menos una categoría de este tipo.');
    const porDefecto =
      hermanas.find((c) => c.nombre === config.categoriaPorDefecto[cat.tipo]) ?? hermanas[hermanas.length - 1];
    const destino = destinoId ?? porDefecto.id;
    if (!hermanas.some((c) => c.id === destino)) throw new Error('Elige otra categoría del mismo tipo.');
    for (const p of await d.presupuestos.where('categoriaId').equals(id).toArray()) {
      const receptor = await d.presupuestos.where('[mes+categoriaId]').equals([p.mes, destino]).first();
      if (receptor) {
        const limite = receptor.limite + p.limite;
        if (!Number.isSafeInteger(limite)) throw new Error('El presupuesto combinado supera el importe permitido.');
        await d.presupuestos.update(receptor.id, { limite });
        await d.presupuestos.delete(p.id);
      } else await d.presupuestos.update(p.id, { categoriaId: destino });
    }
    await d.movimientos.toCollection().modify((m) => {
      if (m.categoriaId === id) m.categoriaId = destino;
      if (m.reparto) {
        const partes = new Map<string, number>();
        for (const p of m.reparto) {
          const clave = p.categoriaId === id ? destino : p.categoriaId;
          partes.set(clave, (partes.get(clave) ?? 0) + p.importe);
        }
        m.reparto =
          partes.size > 1 ? [...partes].map(([categoriaId, importe]) => ({ categoriaId, importe })) : undefined;
        if (partes.size === 1) m.categoriaId = [...partes.keys()][0];
      }
    });
    await d.pagosFijos.filter((p) => p.categoriaId === id).modify({ categoriaId: destino });
    await d.categorias.delete(id);
  });
}

// ── Todo ───────────────────────────────────────────────────────────────────

export async function borrarTodo(d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.tables, async () => {
    await Promise.all(d.tables.map((t) => t.clear()));
  });
}
