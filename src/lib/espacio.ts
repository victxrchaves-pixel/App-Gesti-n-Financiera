import type { Ambito } from '../db/types';
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
