import type { Ajustes } from '../db/types';
import { esColor, mezclar } from './colors';

/** Cómo se ve el fondo de la app: con movimiento, quieto (sin gastar batería) o de un solo color. */
export type EstiloFondo = 'animado' | 'quieto' | 'plano';
export const ESTILOS_FONDO: readonly { valor: EstiloFondo; texto: string }[] = [
  { valor: 'animado', texto: 'Animado' },
  { valor: 'quieto', texto: 'Quieto' },
  { valor: 'plano', texto: 'Plano' },
];

/** Tres tonos por paleta, del más claro al más intenso. */
export type TonosFondo = [string, string, string];
export const PALETAS_FONDO: readonly { id: string; nombre: string; tonos: TonosFondo }[] = [
  { id: 'atardecer', nombre: 'Atardecer', tonos: ['#fed7aa', '#f97316', '#9a3412'] },
  { id: 'oceano', nombre: 'Océano', tonos: ['#bae6fd', '#38bdf8', '#1d4ed8'] },
  { id: 'lavanda', nombre: 'Lavanda', tonos: ['#e9d5ff', '#a78bfa', '#6d28d9'] },
  { id: 'menta', nombre: 'Menta', tonos: ['#bbf7d0', '#34d399', '#047857'] },
  { id: 'rosa', nombre: 'Rosa', tonos: ['#fecdd3', '#fb7185', '#be123c'] },
  { id: 'grafito', nombre: 'Grafito', tonos: ['#e5e7eb', '#9ca3af', '#374151'] },
];
export const TONOS_POR_DEFECTO: TonosFondo = PALETAS_FONDO[0].tonos;
export const NOMBRES_TONOS = ['Tono claro', 'Tono medio', 'Tono intenso'] as const;

export const esEstiloFondo = (v: unknown): v is EstiloFondo => v === 'animado' || v === 'quieto' || v === 'plano';
export const sonTonosFondo = (v: unknown): v is TonosFondo => Array.isArray(v) && v.length === 3 && v.every(esColor);

export function estiloFondo(a?: Pick<Ajustes, 'fondoEstilo'>): EstiloFondo {
  return esEstiloFondo(a?.fondoEstilo) ? a.fondoEstilo : 'animado';
}
export function tonosFondo(a?: Pick<Ajustes, 'fondoColores'>): TonosFondo {
  return sonTonosFondo(a?.fondoColores) ? a.fondoColores : TONOS_POR_DEFECTO;
}

/**
 * Colores para el degradado. Empieza casi en blanco y aclara los tonos elegidos para que
 * los textos oscuros se sigan leyendo encima, aunque se elijan colores muy fuertes.
 */
export function coloresDegradado([claro, medio, intenso]: TonosFondo): string[] {
  return [mezclar(claro, 255, 0.8), mezclar(claro, 255, 0.35), mezclar(medio, 255, 0.35), mezclar(intenso, 255, 0.45)];
}

/** Color único del fondo plano: el tono claro, muy suave. */
export function colorPlano([claro]: TonosFondo) {
  return mezclar(claro, 255, 0.6);
}

/** Un CSS linear-gradient con la paleta, para las muestras de Ajustes. */
export function muestraCss(tonos: TonosFondo) {
  return `linear-gradient(135deg, ${coloresDegradado(tonos).join(', ')})`;
}

export function mismosTonos(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((c, i) => c.toLowerCase() === b[i].toLowerCase());
}
