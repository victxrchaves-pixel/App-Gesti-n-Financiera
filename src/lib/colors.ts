import type { Ajustes } from '../db/types';
export const esColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
export function mezclar(color: string, destino: number, peso: number) {
  const rgb = [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - peso) + destino * peso));
  return '#' + rgb.map(n => n.toString(16).padStart(2, '0')).join('');
}
export function luminancia(color: string) {
  return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
}
/** Texto y trazos legibles sobre blanco incluso con colores muy claros. */
export function tinta(color: string) {
  let resultado = color;
  while ((1.05 / (luminancia(resultado) + .05)) < 4.5) resultado = mezclar(resultado, 0, .08);
  return resultado;
}
export function variablesTema(a?: Ajustes) {
  const color = esColor(a?.colorAcento) ? a.colorAcento : '#444444';
  return {
    '--primary': mezclar(color, 255, .78), '--primary-hover': mezclar(color, 255, .65),
    '--primary-soft': mezclar(color, 255, .93), '--primary-ink': tinta(color),
    '--positive': tinta(color), '--chart-income': esColor(a?.colorIngresos) ? tinta(a.colorIngresos) : tinta(color),
    '--chart-expense': esColor(a?.colorGastos) ? tinta(a.colorGastos) : '#858585',
    '--chart-investment': esColor(a?.colorInversiones) ? tinta(a.colorInversiones) : tinta(color),
  };
}
export const CAMPOS_COLOR = ['colorAcento', 'colorIngresos', 'colorGastos', 'colorInversiones'] as const;
/** Solo sustituye los colores iniciales heredados; conserva otras elecciones anteriores. */
export function neutralizarInicial(c: { nombre: string; color: string }) {
  const antiguos: Record<string, string> = { Casa:'#8860B0', Transporte:'#A080C0', Salud:'#745095', Suscripciones:'#9675B6', Nómina:'#8860B0', 'Otros ingresos':'#A080C0' };
  return antiguos[c.nombre] === c.color?.toUpperCase() ? '#707070' : c.color;
}
