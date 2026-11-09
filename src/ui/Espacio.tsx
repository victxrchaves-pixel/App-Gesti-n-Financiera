import { createContext, useContext, useMemo } from 'react';
import { useCategorias } from '../db/hooks';
import { categoriasDeEspacio } from '../lib/espacio';
import type { Espacio } from '../lib/espacio';

const CLAVE = 'neto-espacio';

/** Espacio en el que está la persona: Personal o Negocio. Las pantallas comunes lo usan para filtrar. */
export const EspacioContext = createContext<Espacio>('personal');
export const useEspacio = () => useContext(EspacioContext);

/** Las categorías que tienen sentido en el espacio actual (sin las del negocio en Personal). */
export function useCategoriasEspacio() {
  const espacio = useEspacio();
  const categorias = useCategorias();
  return useMemo(() => categoriasDeEspacio(categorias, espacio), [categorias, espacio]);
}

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
