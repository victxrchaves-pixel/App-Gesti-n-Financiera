import { config } from '../config/neto.config';
import { addDays } from './dates';

export interface Plazo {
  /** Trimestre que se declara. */
  anio: number;
  trimestre: number;
  /** Primer y último día para presentar, ya movido al siguiente día hábil si caía en fin de semana. */
  inicio: string;
  fin: string;
  /** El último día era sábado o domingo y se ha movido al lunes. */
  movido: boolean;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Si cae en sábado o domingo, pasa al lunes. (Los festivos llegarán con la pantalla de Impuestos.) */
export function siguienteDiaHabil(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dia === 6 ? addDays(fecha, 2) : dia === 0 ? addDays(fecha, 1) : fecha;
}

function plazoDe(anio: number, trimestre: number): Plazo {
  const p = config.autonomo.plazos.find((x) => x.trimestre === trimestre)!;
  const y = p.anioSiguiente ? anio + 1 : anio;
  const finOriginal = iso(y, p.mes, p.diaFin);
  const fin = siguienteDiaHabil(finOriginal);
  return { anio, trimestre, inicio: iso(y, p.mes, p.diaInicio), fin, movido: fin !== finOriginal };
}

/** El próximo plazo de los modelos trimestrales (303 y 130) que aún no ha terminado. */
export function siguientePlazo(hoy: string): Plazo {
  const anio = Number(hoy.slice(0, 4));
  const candidatos = [plazoDe(anio - 1, 4), ...[1, 2, 3, 4].map((t) => plazoDe(anio, t))];
  return candidatos.find((p) => p.fin >= hoy) ?? plazoDe(anio + 1, 1);
}

export function diasHasta(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}
