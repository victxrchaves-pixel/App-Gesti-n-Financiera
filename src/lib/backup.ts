import { config } from '../config/neto.config';
import { db, TABLAS, type NetoDB, type NombreTabla } from '../db/db';
import { isISODate } from './dates';

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
    const filas = entrada.datos[t] ?? [];
    if (!Array.isArray(filas)) return { ok: false, error: `La tabla «${t}» de la copia no es válida.` };
    for (const fila of filas) {
      if (!esObjeto(fila) || typeof fila.id !== 'string') return { ok: false, error: `Hay un registro sin identificador en «${t}».` };
    }
    datos[t] = filas;
  }
  for (const c of datos.cuentas as Record<string, unknown>[]) {
    if (!esEntero(c.saldoInicial)) return { ok: false, error: `La cuenta «${String(c.nombre)}» tiene un saldo no válido.` };
  }
  for (const m of datos.movimientos as Record<string, unknown>[]) {
    if (!esEntero(m.importe) || (m.importe as number) <= 0 || typeof m.fecha !== 'string' || !isISODate(m.fecha)) {
      return { ok: false, error: 'Hay movimientos con importe o fecha no válidos.' };
    }
  }
  return { ok: true, copia: { app: 'neto', version: entrada.version as number, exportadaEn: String(entrada.exportadaEn ?? ''), datos } };
}

/** Sustituye TODOS los datos actuales por los de la copia, en una sola transacción. */
export async function restaurarCopia(copia: CopiaNeto, d: NetoDB = db): Promise<void> {
  await d.transaction('rw', d.tables, async () => {
    for (const t of TABLAS) {
      await d.table(t).clear();
      await d.table(t).bulkAdd(copia.datos[t] ?? []);
    }
  });
}

export function resumenCopia(copia: CopiaNeto): string {
  const n = (t: NombreTabla) => copia.datos[t]?.length ?? 0;
  return `${n('cuentas')} cuentas, ${n('movimientos')} movimientos y ${n('categorias')} categorías`;
}
