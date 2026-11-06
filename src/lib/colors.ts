import type { Ajustes } from '../db/types';
export const COLORES_UX = { ingreso: '#16803C', gasto: '#C73535', inversion: '#2563B8', aviso: '#9A6700' } as const;
export const COLORES_CATEGORIAS: Record<string, string> = {
  Casa: '#8B5FBF',
  Comida: '#16803C',
  Transporte: '#2563B8',
  Ocio: '#C07816',
  Salud: '#0F817D',
  Ropa: '#BA4E83',
  Suscripciones: '#5D62C2',
  Otros: '#64748B',
  Nómina: '#16803C',
  'Otros ingresos': '#0F817D',
};
export const COLORES_INVERSION: Record<string, string> = {
  cripto: '#C07816',
  divisa: '#0F817D',
  accion: '#2563B8',
  fondo: '#8B5FBF',
  otra: '#64748B',
};
export const COLORES_MARCAS: Record<string, string> = {
  icloud: '#3693F3',
  googleone: '#4285F4',
  dropbox: '#0061FF',
  microsoft365: '#D83B01',
  netflix: '#E50914',
  primevideo: '#0078B8',
  spotify: '#1DB954',
  youtube: '#FF0000',
  adobe: '#EB1000',
  figma: '#F24E1E',
  notion: '#191919',
  github: '#181717',
  chatgpt: '#0F817D',
  claude: '#C15F3C',
};
export function colorCategoriaSugerido(nombre: string) {
  return COLORES_CATEGORIAS[nombre] ?? '#64748B';
}
export function colorSemanticoInicial(c: { nombre: string; color: string }) {
  const anteriores: Record<string, string[]> = {
    Casa: ['#707070'],
    Comida: ['#363636'],
    Transporte: ['#707070'],
    Ocio: ['#595959'],
    Salud: ['#707070'],
    Ropa: ['#707070'],
    Suscripciones: ['#707070'],
    Otros: ['#858585'],
    Nómina: ['#707070'],
    'Otros ingresos': ['#707070'],
  };
  return anteriores[c.nombre]?.includes(c.color?.toUpperCase()) ? colorCategoriaSugerido(c.nombre) : c.color;
}
export const esColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export function mezclar(color: string, destino: number, peso: number) {
  const rgb = [1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - peso) + destino * peso));
  return '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
}
export function luminancia(color: string) {
  return [1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
/** Texto y trazos legibles sobre blanco incluso con colores muy claros. */
export function tinta(color: string) {
  let resultado = color;
  while (1.05 / (luminancia(resultado) + 0.05) < 4.5) resultado = mezclar(resultado, 0, 0.08);
  return resultado;
}
export function variablesTema(a?: Ajustes) {
  const color = esColor(a?.colorAcento) ? a.colorAcento : '#444444';
  return {
    '--primary': mezclar(color, 255, 0.78),
    '--primary-hover': mezclar(color, 255, 0.65),
    '--primary-soft': mezclar(color, 255, 0.93),
    '--primary-ink': tinta(color),
    '--positive': COLORES_UX.ingreso,
    '--chart-income': esColor(a?.colorIngresos) ? tinta(a.colorIngresos) : COLORES_UX.ingreso,
    '--chart-expense': esColor(a?.colorGastos) ? tinta(a.colorGastos) : COLORES_UX.gasto,
    '--chart-investment': esColor(a?.colorInversiones) ? tinta(a.colorInversiones) : COLORES_UX.inversion,
  };
}
export const CAMPOS_COLOR = ['colorAcento', 'colorIngresos', 'colorGastos', 'colorInversiones'] as const;
/** Solo sustituye los colores iniciales heredados; conserva otras elecciones anteriores. */
export function neutralizarInicial(c: { nombre: string; color: string }) {
  const antiguos: Record<string, string> = {
    Casa: '#8860B0',
    Transporte: '#A080C0',
    Salud: '#745095',
    Suscripciones: '#9675B6',
    Nómina: '#8860B0',
    'Otros ingresos': '#A080C0',
  };
  return antiguos[c.nombre] === c.color?.toUpperCase() ? '#707070' : c.color;
}
