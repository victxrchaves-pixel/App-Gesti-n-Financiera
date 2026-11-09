import { createContext, useContext } from 'react';
import type { Espacio } from '../lib/espacio';

const CLAVE = 'neto-espacio';

/** Espacio en el que está la persona: Personal o Negocio. Las pantallas comunes lo usan para filtrar. */
export const EspacioContext = createContext<Espacio>('personal');
export const useEspacio = () => useContext(EspacioContext);

/** Último espacio usado en este navegador, para volver a él al abrir Neto. */
export function leerEspacioGuardado(): Espacio {
  try {
    return localStorage.getItem(CLAVE) === 'negocio' ? 'negocio' : 'personal';
  } catch {
    return 'personal';
  }
}

export function guardarEspacio(e: Espacio) {
  try {
    localStorage.setItem(CLAVE, e);
  } catch {
    // Sin almacenamiento (modo privado): solo se pierde el recuerdo del último espacio.
  }
}
