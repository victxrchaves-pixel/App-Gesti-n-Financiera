import type { Movimiento } from '../db/types';
import { isISODate, todayISO } from './dates';
import { parseMoney } from './money';
export interface FilaCSV {
  linea: number;
  fecha: string;
  nota: string;
  importe: number;
  tipo: 'gasto' | 'ingreso';
  error?: string;
  duplicado: boolean;
}
export interface ColumnasCSV {
  fecha: number;
  nota: number;
  importe: number;
  modo: 'signo' | 'gasto' | 'ingreso';
}

function leerSeparado(texto: string, sep: string) {
  const filas: string[][] = [];
  let fila: string[] = [],
    campo = '',
    comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (comillas && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (comillas || campo === '') comillas = !comillas;
      else throw new Error('Hay comillas fuera de lugar en el CSV.');
    } else if (c === sep && !comillas) {
      fila.push(campo.trim());
      campo = '';
    } else if ((c === '\n' || c === '\r') && !comillas) {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo.trim());
      if (fila.some(Boolean)) filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (comillas) throw new Error('Hay un campo entre comillas sin cerrar.');
  fila.push(campo.trim());
  if (fila.some(Boolean)) filas.push(fila);
  return filas;
}
export function leerCSV(texto: string, separador?: string) {
  const limpio = texto.replace(/^\uFEFF/, '');
  const opciones = separador ? [separador] : [';', ',', '\t'];
  const intentos = opciones.map((sep) => {
    try {
      return { sep, filas: leerSeparado(limpio, sep) };
    } catch {
      return { sep, filas: [] as string[][] };
    }
  });
  const mejor = intentos.sort((a, b) => (b.filas[0]?.length ?? 0) - (a.filas[0]?.length ?? 0))[0];
  if (!mejor?.filas.length || (mejor.filas[0]?.length ?? 0) < 2)
    throw new Error('No se reconoce la tabla CSV. Usa una cabecera y separadores de coma, punto y coma o tabulador.');
  if (mejor.filas.length > 5001) throw new Error('Importa como máximo 5.000 movimientos por archivo.');
  return { cabecera: mejor.filas[0], filas: mejor.filas.slice(1), separador: mejor.sep };
}
export function fechaCSV(texto: string) {
  if (isISODate(texto)) return texto;
  const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(texto);
  if (!m) return '';
  const fecha = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isISODate(fecha) ? fecha : '';
}
export const firmaMovimiento = (m: Pick<Movimiento, 'fecha' | 'tipo' | 'importe' | 'cuentaId' | 'nota'>) =>
  JSON.stringify([m.cuentaId, m.fecha, m.tipo, m.importe, m.nota.trim().replace(/\s+/g, ' ').toLocaleLowerCase()]);
export function prepararCSV(
  filas: string[][],
  columnas: ColumnasCSV,
  cuentaId: string,
  existentes: Movimiento[],
  hoy = todayISO(),
): FilaCSV[] {
  const cantidades = new Map<string, number>();
  for (const m of existentes) {
    const clave = firmaMovimiento(m);
    cantidades.set(clave, (cantidades.get(clave) ?? 0) + 1);
  }
  return filas.map((fila, i) => {
    const fecha = fechaCSV(fila[columnas.fecha] ?? ''),
      nota = (fila[columnas.nota] ?? '').trim(),
      valor = parseMoney(fila[columnas.importe] ?? '');
    const tipo = columnas.modo === 'signo' ? (valor !== null && valor < 0 ? 'gasto' : 'ingreso') : columnas.modo;
    const importe = Math.abs(valor ?? 0),
      clave = firmaMovimiento({ fecha, nota, tipo, importe, cuentaId });
    const duplicado = (cantidades.get(clave) ?? 0) > 0;
    if (duplicado) cantidades.set(clave, cantidades.get(clave)! - 1);
    const error = !fecha
      ? 'Fecha no válida'
      : fecha > hoy
        ? 'Fecha futura'
        : valor === null || !importe
          ? 'Importe no válido'
          : fila.length <= Math.max(columnas.fecha, columnas.nota, columnas.importe)
            ? 'Faltan columnas'
            : undefined;
    return { linea: i + 2, fecha, nota, importe, tipo, error, duplicado };
  });
}
