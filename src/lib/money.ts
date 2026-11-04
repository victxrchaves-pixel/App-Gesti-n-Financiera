import { config } from '../config/neto.config';

/**
 * Todos los importes de Neto son céntimos enteros (1234,56 € → 123456).
 * Aquí está lo único que convierte entre céntimos y texto.
 */

const MENOS = '−'; // signo menos tipográfico
const ESPACIO_FINO = ' '; // espacio que no parte la línea antes de "€"

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Importe no válido: ${cents}. Los importes deben ser céntimos enteros.`);
  }
}

function agruparMiles(digitos: string): string {
  const sep = config.moneda.separadorMiles;
  let out = '';
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) out += sep;
    out += digitos[i];
  }
  return out;
}

export interface FormatOptions {
  /** 'auto': solo el menos; 'siempre': también + en positivos; 'nunca': valor absoluto. */
  signo?: 'auto' | 'siempre' | 'nunca';
  /** Añadir " €" al final. Por defecto, sí. */
  simbolo?: boolean;
  /** Ocultar los céntimos cuando son ,00 (útil en ejes de gráficos). */
  sinCentimosSiCero?: boolean;
}

/** 123456 → "1.234,56 €" (con espacio de no separación antes del símbolo). */
export function formatMoney(cents: number, opts: FormatOptions = {}): string {
  assertCents(cents);
  const { signo = 'auto', simbolo = true, sinCentimosSiCero = false } = opts;
  const abs = Math.abs(cents);
  const euros = agruparMiles(String(Math.floor(abs / 100)));
  const cent = String(abs % 100).padStart(2, '0');
  const numero = sinCentimosSiCero && cent === '00' ? euros : `${euros}${config.moneda.separadorDecimales}${cent}`;
  let prefijo = '';
  if (signo !== 'nunca') {
    if (cents < 0) prefijo = MENOS;
    else if (signo === 'siempre' && cents > 0) prefijo = '+';
  }
  return `${prefijo}${numero}${simbolo ? ESPACIO_FINO + config.moneda.simbolo : ''}`;
}

/** Texto para un campo de formulario: 123456 → "1234,56" (sin miles ni símbolo). */
export function centsToInput(cents: number): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${s}` : s;
}

function agrupacionValida(parte: string, sep: string): boolean {
  const grupos = parte.split(sep);
  if (grupos.length === 1) return true;
  return /^\d{1,3}$/.test(grupos[0]) && grupos.slice(1).every((g) => /^\d{3}$/.test(g));
}

/**
 * Convierte lo que escribe una persona (o lo que trae un CSV del banco) a céntimos.
 * Acepta "1.234,56", "1234,56", "1234.56", "12,5", "-12,50 €", "12,50-"...
 * Devuelve null si el texto no es un importe.
 * Regla para el punto suelto: "12.500" son 12.500 € (miles); "12.5" son 12,50 €.
 */
export function parseMoney(texto: string): number | null {
  let s = texto.trim().replace(/[\s ]/g, '').replace(/€|eur/gi, '');
  if (s === '') return null;
  let negativo = false;
  if (/^[-−]/.test(s)) {
    negativo = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (/[-−]$/.test(s)) {
    negativo = !negativo;
    s = s.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  let entera: string;
  let decimales = '';
  const ultimaComa = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const dec = ultimaComa > ultimoPunto ? ',' : '.';
    const miles = dec === ',' ? '.' : ',';
    const partes = s.split(dec);
    if (partes.length !== 2 || !agrupacionValida(partes[0], miles)) return null;
    entera = partes[0].split(miles).join('');
    decimales = partes[1];
  } else if (ultimaComa >= 0) {
    const partes = s.split(',');
    if (partes.length !== 2) return null;
    [entera, decimales] = partes;
  } else if (ultimoPunto >= 0) {
    const partes = s.split('.');
    if (partes.length === 2 && partes[1].length !== 3) {
      [entera, decimales] = partes;
    } else {
      if (!agrupacionValida(s, '.')) return null;
      entera = partes.join('');
    }
  } else {
    entera = s;
  }

  if (entera === '') entera = '0';
  if (!/^\d+$/.test(entera) || !/^\d*$/.test(decimales)) return null;

  const dos = (decimales + '00').slice(0, 2);
  const redondeo = decimales.length > 2 && decimales[2] >= '5' ? 1 : 0;
  const cents = Number(entera) * 100 + Number(dos) + redondeo;
  if (!Number.isSafeInteger(cents)) return null;
  return negativo ? -cents : cents;
}

export function sumCents(valores: Iterable<number>): number {
  let total = 0;
  for (const v of valores) {
    assertCents(v);
    total += v;
  }
  return total;
}

/** Porcentaje entero (0–∞) de `parte` sobre `total`, redondeado. 0 si total es 0. */
export function porcentaje(parte: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((parte / total) * 100);
}
