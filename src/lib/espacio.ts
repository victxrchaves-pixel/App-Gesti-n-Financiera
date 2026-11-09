import { config } from '../config/neto.config';
import type { Ambito, Categoria } from '../db/types';
import type { Ruta } from '../router';

/** Neto se divide en dos espacios que no se mezclan: tus finanzas personales y tu negocio. */
export type Espacio = Ambito;

/** Rutas que solo existen en el espacio del negocio. */
export const RUTAS_NEGOCIO: readonly Ruta[] = [
  'negocio',
  'facturas',
  'gastos',
  'impuestos',
  'negocio-movimientos',
  'negocio-cuentas',
  'suscripciones-negocio',
];

/** Rutas comunes a los dos espacios: se quedan en el espacio desde el que se abrieron. */
const COMUNES: readonly Ruta[] = ['ajustes'];

export function espacioDeRuta(ruta: Ruta, anterior: Espacio): Espacio {
  if (RUTAS_NEGOCIO.includes(ruta)) return 'negocio';
  if (COMUNES.includes(ruta)) return anterior;
  return 'personal';
}

/** Pares de pantallas equivalentes: al cambiar de espacio se va a la misma pantalla del otro lado. */
const EQUIVALENTES: [Ruta, Ruta][] = [
  ['inicio', 'negocio'],
  ['movimientos', 'negocio-movimientos'],
  ['cuentas', 'negocio-cuentas'],
  ['suscripciones', 'suscripciones-negocio'],
  ['recurrentes', 'suscripciones-negocio'],
];

export function rutaAlCambiar(ruta: Ruta, destino: Espacio): Ruta {
  if (COMUNES.includes(ruta)) return ruta;
  for (const [personal, negocio] of EQUIVALENTES) {
    if (destino === 'negocio' && ruta === personal) return negocio;
    if (destino === 'personal' && ruta === negocio) return personal;
  }
  return destino === 'negocio' ? 'negocio' : 'inicio';
}

export const inicioDe = (e: Espacio): Ruta => (e === 'negocio' ? 'negocio' : 'inicio');

const NOMBRES_NEGOCIO = [config.autonomo.categoriaCobros, config.autonomo.categoriaPagos].map((n) => n.toLowerCase());

/** Categorías que Neto crea para el negocio (también las de antes de marcarlas, por su nombre). */
export function esCategoriaNegocio(c: Pick<Categoria, 'nombre'> & { negocio?: boolean }): boolean {
  return c.negocio === true || NOMBRES_NEGOCIO.includes(c.nombre.trim().toLowerCase());
}

/** En Personal no aparecen las categorías del negocio; en Negocio van primero. */
export function categoriasDeEspacio<T extends Pick<Categoria, 'nombre'> & { negocio?: boolean }>(
  categorias: readonly T[],
  espacio: Espacio,
): T[] {
  if (espacio === 'personal') return categorias.filter((c) => !esCategoriaNegocio(c));
  return [...categorias.filter(esCategoriaNegocio), ...categorias.filter((c) => !esCategoriaNegocio(c))];
}
