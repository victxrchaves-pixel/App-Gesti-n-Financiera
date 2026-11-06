import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
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

export function useSuscripciones() { return useLiveQuery(() => db.suscripciones.orderBy('proximaFecha').toArray(), [], []); }
export function useInversiones() { return useLiveQuery(() => db.inversiones.toArray(), [], []); }
export function useHistorialCartera() { return useLiveQuery(() => db.historialCartera.orderBy('fecha').toArray(), [], []); }
export function usePresupuestos(mes: string) { return useLiveQuery(() => db.presupuestos.where('mes').equals(mes).toArray(), [mes], []); }

export function useMetas() { return useLiveQuery(() => db.metas.toArray(), [], []); }
export function useAportesMetas() { return useLiveQuery(() => db.aportesMetas.orderBy('mes').toArray(), [], []); }

export function usePagosFijos() { return useLiveQuery(() => db.pagosFijos.toArray(), [], []); }
export function usePagosRegistrados() { return useLiveQuery(() => db.pagosRegistrados.orderBy('fecha').reverse().toArray(), [], []); }

export function usePlanMes(mes:string) { return useLiveQuery(()=>db.planesMes.get(mes),[mes]); }
export function useHoy() {
  const fecha=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const [hoy,setHoy]=useState(fecha);
  useEffect(()=>{const actualizar=()=>setHoy(fecha());const timer=setInterval(actualizar,30000);window.addEventListener('focus',actualizar);return()=>{clearInterval(timer);window.removeEventListener('focus',actualizar)}},[]);
  return hoy;
}
