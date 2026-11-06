import { agruparAhorro } from '../db/savings';
import type { Cuenta } from '../db/types';
import { validarPagoFijo } from '../db/recurring';
import type { PagoFijo, PagoRegistrado } from '../db/types';
import { validarMeta, validarAporte } from '../db/goals';
import type { Meta, AporteMeta } from '../db/types';
import { CAMPOS_COLOR, esColor, neutralizarInicial, colorSemanticoInicial } from './colors';
import { config } from '../config/neto.config';
import { db, TABLAS, type NetoDB, type NombreTabla } from '../db/db';
import { isISODate } from './dates';
import { validarSuscripcion } from './subscriptions';
import { validarInversion } from './investments';
import type { Inversion, Suscripcion, Presupuesto } from '../db/types';
import { validarPresupuesto } from './budgets';

/** Formato del archivo de copia de seguridad. */
export interface CopiaNeto {
  app: 'neto';
  version: number;
  exportadaEn: string;
  datos: Record<NombreTabla, unknown[]>;
}

export async function crearCopia(d: NetoDB = db, ahora: Date = new Date()): Promise<CopiaNeto> {
  const datos = {} as Record<NombreTabla, unknown[]>;
  await d.transaction('r', d.tables, async () => {
    for (const t of TABLAS) datos[t] = await d.table(t).toArray();
  });
  return { app: 'neto', version: config.copiaSeguridad.version, exportadaEn: ahora.toISOString(), datos };
}

export function nombreArchivoCopia(ahora: Date = new Date()): string {
  const f = ahora.toISOString().slice(0, 10);
  return `${config.copiaSeguridad.prefijoArchivo}-${f}.json`;
}

export type ResultadoValidacion = { ok: true; copia: CopiaNeto } | { ok: false; error: string };

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const esEntero = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v);

/** Comprueba que un archivo es una copia de Neto que se puede restaurar sin romper nada. */
export function validarCopia(entrada: unknown): ResultadoValidacion {
  if (!esObjeto(entrada) || entrada.app !== 'neto') {
    return { ok: false, error: 'Este archivo no es una copia de seguridad de Neto.' };
  }
  if (!esEntero(entrada.version)) return { ok: false, error: 'La copia no indica su versión.' };
  if ((entrada.version as number) > config.copiaSeguridad.version) {
    return { ok: false, error: 'La copia se hizo con una versión más nueva de Neto. Actualiza la app para restaurarla.' };
  }
  if (!esObjeto(entrada.datos)) return { ok: false, error: 'La copia está incompleta.' };
  const datos = {} as Record<NombreTabla, unknown[]>;
  for (const t of TABLAS) {
    const ids = new Set<string>();
    const filas = entrada.datos[t] ?? [];
    if (!Array.isArray(filas)) return { ok: false, error: `La tabla «${t}» de la copia no es válida.` };
    for (const fila of filas) {
      if (!esObjeto(fila) || typeof fila.id !== 'string' || !fila.id || ids.has(fila.id)) return { ok: false, error: `Hay un registro sin identificador en «${t}».` };
      ids.add(fila.id);
    }
    datos[t] = filas;
  }
  for (const a of datos.ajustes as Record<string, unknown>[]) for (const campo of CAMPOS_COLOR) if (a[campo] != null && !esColor(a[campo])) return { ok: false, error: 'La copia contiene un color de apariencia no válido.' };
  for (const c of datos.categorias as Record<string, unknown>[]) if (!esColor(c.color)) return { ok: false, error: 'La copia contiene un color de categoría no válido.' };
  for (const c of datos.cuentas as Record<string, unknown>[]) {
    if (!esEntero(c.saldoInicial)) return { ok: false, error: `La cuenta «${String(c.nombre)}» tiene un saldo no válido.` };
  }
  const cuentas=datos.cuentas as Cuenta[];
  for(const c of cuentas){
    if(c.ahorroGeneral!=null&&typeof c.ahorroGeneral!=='boolean')return {ok:false,error:'La cuenta general de ahorro no es válida.'};
    if(c.cuentaPadreId!=null&&(typeof c.cuentaPadreId!=='string'||!c.cuentaPadreId))return {ok:false,error:'La división de ahorro no es válida.'};
    if(c.ahorroGeneral&&(c.tipo!=='ahorro'||c.ambito!=='personal'||c.cuentaPadreId))return {ok:false,error:'La cuenta general de ahorro no es válida.'};
    if(c.cuentaPadreId){
      const padre=cuentas.find(p=>p.id===c.cuentaPadreId);
      if(!padre||padre.id===c.id||padre.cuentaPadreId||!padre.ahorroGeneral||padre.tipo!=='ahorro'||padre.ambito!=='personal'||c.tipo!=='ahorro'||c.ambito!=='personal')return {ok:false,error:'Una división del ahorro tiene una cuenta general no válida.'};
    }
  }
  if(cuentas.filter(c=>c.ahorroGeneral&&!c.eliminada&&!c.archivada).length>1)return {ok:false,error:'Hay más de una cuenta general de ahorro.'};
  const operaciones = new Set<string>();
  for (const m of datos.movimientos as Record<string, unknown>[]) {
    if(m.operacionId != null) {
      if(typeof m.operacionId !== 'string' || !m.operacionId || operaciones.has(m.operacionId))return {ok:false,error:'Hay operaciones de movimientos inválidas o duplicadas.'};
      operaciones.add(m.operacionId);
    }
    if (!esEntero(m.importe) || (m.importe as number) <= 0 || typeof m.fecha !== 'string' || !isISODate(m.fecha)) {
      return { ok: false, error: 'Hay movimientos con importe o fecha no válidos.' };
    }
  }
  for (const s of datos.suscripciones) {
    const error = validarSuscripcion(s as Suscripcion);
    if (error) return { ok: false, error: `Suscripción no válida: ${error}` };
  }
  for (const i of datos.inversiones) {
    const error = validarInversion(i as Inversion);
    if (error) return { ok: false, error: `Inversión no válida: ${error}` };
  }
  for (const h of datos.historialCartera as Record<string, unknown>[]) {
    if (typeof h.fecha !== 'string' || !Number.isFinite(Date.parse(h.fecha)) || !esEntero(h.total) || (h.total as number) < 0 || !esEntero(h.coste) || (h.coste as number) < 0 || !esObjeto(h.valores) || !Object.values(h.valores).every(n => esEntero(n) && (n as number) >= 0)) {
      return { ok: false, error: 'El historial de inversiones contiene una valoración no válida.' };
    }
  }
  for (const m of datos.metas as Meta[]) {
    const error = validarMeta(m); if (error) return { ok: false, error: `Meta no válida: ${error}` };
    if (m.cuentaOrigenId) {
      const cuentas = datos.cuentas as { id:string; ambito:string }[];
      if (!cuentas.some(c=>c.id===m.cuentaOrigenId&&c.ambito==='personal') || !cuentas.some(c=>c.id===m.cuentaAhorroId&&c.ambito==='personal') || m.cuentaOrigenId===m.cuentaAhorroId) return {ok:false,error:'Una meta tiene cuentas de origen o destino no válidas.'};
    }
  }
  for (const f of datos.pagosFijos as PagoFijo[]) { const error=validarPagoFijo(f); if(error)return {ok:false,error:`Recurrente no válido: ${error}`}; }
  const pagosUnicos=new Set<string>();
  for(const p of datos.pagosRegistrados as PagoRegistrado[]){const key=JSON.stringify([p.origen,p.recurrenteId,p.periodoFecha]);if(!['fijo','suscripcion'].includes(p.origen)||typeof p.recurrenteId!=='string'||!p.recurrenteId||!isISODate(p.periodoFecha)||!isISODate(p.fecha)||!esEntero(p.importe)||p.importe<=0||typeof p.movimientoId!=='string'||!p.movimientoId||pagosUnicos.has(key))return {ok:false,error:'Hay registros de recurrentes inválidos o duplicados.'};pagosUnicos.add(key);}
  const aportesUnicos = new Set<string>();
  const totalesMetas = new Map((datos.metas as Meta[]).map(m => [m.id, m.inicial]));
  for (const a of datos.aportesMetas as AporteMeta[]) {
    const key = JSON.stringify([a.metaId, a.mes, a.grupoId ?? a.id]);
    if (!validarAporte(a) || !totalesMetas.has(a.metaId) || aportesUnicos.has(key)) return { ok: false, error: 'Hay aportaciones de metas inválidas o duplicadas.' };
    aportesUnicos.add(key);
    const total = totalesMetas.get(a.metaId)! + a.importe;
    if (!Number.isSafeInteger(total)) return { ok: false, error: 'El total de una meta supera el importe permitido.' };
    totalesMetas.set(a.metaId, total);
  }
  const gruposReserva=new Map<string,AporteMeta[]>();
  for(const a of datos.aportesMetas as AporteMeta[])if(a.origen==='transferencia'&&a.movimientoId)gruposReserva.set(a.movimientoId,[...(gruposReserva.get(a.movimientoId)??[]),a]);
  for(const [id,filas] of gruposReserva){
    const total=filas.reduce((s,a)=>s+a.importe,0);const mov=(datos.movimientos as {id:string;tipo:string;cuentaDestinoId?:string;importe:number}[]).find(m=>m.id===id);
    if(total>0&&(!mov||mov.tipo!=='transferencia'||mov.importe!==total||filas.some(a=>(datos.metas as Meta[]).find(m=>m.id===a.metaId)?.cuentaAhorroId!==mov.cuentaDestinoId)))return {ok:false,error:'El reparto de una aportación no coincide con su transferencia real.'};
  }
  const claves = new Set<string>();
  const totales = new Map<string, number>();
  for (const p of datos.presupuestos as Presupuesto[]) {
    const error = validarPresupuesto(p);
    if (error) return { ok: false, error: `Presupuesto no válido: ${error}` };
    const clave = JSON.stringify([p.mes, p.categoriaId]);
    if (claves.has(clave)) return { ok: false, error: 'Hay presupuestos duplicados para la misma categoría y mes.' };
    claves.add(clave);
    if (!(datos.categorias as Record<string, unknown>[]).some(c => c.id === p.categoriaId && c.tipo === 'gasto')) return { ok: false, error: 'Un presupuesto usa una categoría de gasto que no existe en la copia.' };
    const total = (totales.get(p.mes) ?? 0) + p.limite;
    if (!Number.isSafeInteger(total)) return { ok: false, error: 'El presupuesto mensual supera el importe permitido.' };
    totales.set(p.mes, total);
  }
  return { ok: true, copia: { app: 'neto', version: entrada.version as number, exportadaEn: String(entrada.exportadaEn ?? ''), datos } };
}

/** Sustituye TODOS los datos actuales por los de la copia, en una sola transacción. */
export async function restaurarCopia(copia: CopiaNeto, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.tables, async () => {
    for (const t of TABLAS) {
      await d.table(t).clear();
      const filas = copia.datos[t] ?? [];
      await d.table(t).bulkAdd(t === 'cuentas' ? (filas as {archivada?:boolean}[]).map(c=>({...c,...(c.archivada?{eliminada:true}:{}),archivada:false})) : t === 'categorias' && copia.version < 7 ? (filas as { nombre: string; color: string }[]).map(c => ({ ...c, color: colorSemanticoInicial({ ...c, color: copia.version < 4 ? neutralizarInicial(c) : c.color }) })) : filas);
    }
    await agruparAhorro(d);
    const eliminadas = new Set((await d.cuentas.toArray()).filter(c=>c.eliminada).map(c=>c.id));
    await d.metas.toCollection().modify(m=>{ if(eliminadas.has(m.cuentaOrigenId??'')||eliminadas.has(m.cuentaAhorroId??''))m.activa=false; });
  });
}

export function resumenCopia(copia: CopiaNeto): string {
  const n = (t: NombreTabla) => t==='cuentas'?(copia.datos.cuentas as Cuenta[]).filter(c=>!c.cuentaPadreId&&!c.eliminada).length:copia.datos[t]?.length ?? 0;
  return `${n('cuentas')} cuentas, ${n('movimientos')} movimientos, ${n('categorias')} categorías, ${n('suscripciones')} suscripciones, ${n('inversiones')} inversiones, ${n('presupuestos')} presupuestos, ${n('metas')} metas, ${n('pagosFijos')} recurrentes y ${n('pagosRegistrados')} pagos/cobros registrados`;
}
