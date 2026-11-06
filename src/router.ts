import { useEffect, useState } from 'react';

/** Navegación por "#/ruta": funciona igual en el navegador y en la app de escritorio. */
export type Ruta =
  | 'inicio'
  | 'movimientos'
  | 'presupuestos'
  | 'metas'
  | 'cuentas'
  | 'recurrentes'
  | 'suscripciones'
  | 'suscripciones-negocio'
  | 'inversion'
  | 'facturas'
  | 'gastos'
  | 'impuestos'
  | 'ajustes';

const RUTAS: Ruta[] = [
  'inicio',
  'recurrentes',
  'suscripciones',
  'suscripciones-negocio',
  'inversion',
  'movimientos',
  'presupuestos',
  'metas',
  'cuentas',
  'facturas',
  'gastos',
  'impuestos',
  'ajustes',
];

function leer(): Ruta {
  const r = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Ruta;
  return RUTAS.includes(r) ? r : 'inicio';
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(leer);
  useEffect(() => {
    const on = () => setRuta(leer());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return ruta;
}

export function ir(ruta: Ruta) {
  window.location.hash = `#/${ruta}`;
}
