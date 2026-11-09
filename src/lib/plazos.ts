import { config } from '../config/neto.config';
import { addDays } from './dates';

export interface Plazo {
  /** Trimestre que se declara. */
  anio: number;
  trimestre: number;
  /** Primer y último día para presentar, ya movido al siguiente día hábil si caía en fin de semana o festivo. */
  inicio: string;
  fin: string;
  /** Último día para presentar con cargo en cuenta (domiciliación), movido los mismos días que el plazo. */
  domiciliacion: string;
  /** El último día era inhábil y se ha movido. */
  movido: boolean;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
export function domingoDePascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(anio, mes, dia);
}

export function esFestivoNacional(fecha: string): boolean {
  const anio = Number(fecha.slice(0, 4));
  return (
    config.autonomo.festivosNacionales.includes(fecha.slice(5) as never) || fecha === addDays(domingoDePascua(anio), -2)
  );
}

export function esInhabil(fecha: string): boolean {
  const [y, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dia === 0 || dia === 6 || esFestivoNacional(fecha);
}

/** Si cae en sábado, domingo o festivo nacional, pasa al siguiente día hábil. */
export function siguienteDiaHabil(fecha: string): string {
  let f = fecha;
  while (esInhabil(f)) f = addDays(f, 1);
  return f;
}

export function diasHasta(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

export function plazoDe(anio: number, trimestre: number): Plazo {
  const p = config.autonomo.plazos.find((x) => x.trimestre === trimestre)!;
  const y = p.anioSiguiente ? anio + 1 : anio;
  const finOriginal = iso(y, p.mes, p.diaFin);
  const fin = siguienteDiaHabil(finOriginal);
  return {
    anio,
    trimestre,
    inicio: iso(y, p.mes, p.diaInicio),
    fin,
    domiciliacion: addDays(iso(y, p.mes, p.diaDomiciliacion), diasHasta(finOriginal, fin)),
    movido: fin !== finOriginal,
  };
}

/** El próximo plazo de los modelos trimestrales (303 y 130) que aún no ha terminado. */
export function siguientePlazo(hoy: string): Plazo {
  const anio = Number(hoy.slice(0, 4));
  const candidatos = [plazoDe(anio - 1, 4), ...[1, 2, 3, 4].map((t) => plazoDe(anio, t))];
  return candidatos.find((p) => p.fin >= hoy) ?? plazoDe(anio + 1, 1);
}
