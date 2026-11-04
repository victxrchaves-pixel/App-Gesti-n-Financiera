import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { saldosPorCuenta } from '../lib/balances';
import { db } from './db';
import { AJUSTES_POR_DEFECTO } from './repo';
import type { Categoria } from './types';

/** Lecturas reactivas: las pantallas se actualizan solas cuando cambian los datos. */

export function useAjustes() {
  return useLiveQuery(async () => (await db.ajustes.get('ajustes')) ?? AJUSTES_POR_DEFECTO);
}

export function useCuentas() {
  return useLiveQuery(() => db.cuentas.orderBy('orden').toArray(), [], []);
}

export function useCategorias() {
  return useLiveQuery(() => db.categorias.orderBy('orden').toArray(), [], []);
}

export function useMovimientos() {
  return useLiveQuery(() => db.movimientos.toArray(), [], []);
}

export function useSaldos() {
  const cuentas = useCuentas();
  const movimientos = useMovimientos();
  return useMemo(() => saldosPorCuenta(cuentas, movimientos), [cuentas, movimientos]);
}

export function useMapaCategorias(): Map<string, Categoria> {
  const categorias = useCategorias();
  return useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
}
