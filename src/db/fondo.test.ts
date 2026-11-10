import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NetoDB } from './db';
import { completarInicio, guardarAjustes } from './repo';
import { crearCopia, restaurarCopia, validarCopia } from '../lib/backup';
import { luminancia } from '../lib/colors';
import { PALETAS_FONDO, TONOS_POR_DEFECTO, colorPlano, coloresDegradado, estiloFondo, tonosFondo } from '../lib/fondo';

let d: NetoDB;
let n = 0;
beforeEach(async () => {
  d = new NetoDB('fondo-' + ++n);
  await completarInicio({ nombre: 'Alex', autonomo: false }, d);
});
afterEach(async () => {
  await d.delete();
});

it('empieza con el fondo animado y la paleta por defecto', async () => {
  const a = await d.ajustes.get('ajustes');
  expect(estiloFondo(a)).toBe('animado');
  expect(tonosFondo(a)).toEqual(TONOS_POR_DEFECTO);
});

it('guarda el estilo y los colores del fondo, y viajan en las copias', async () => {
  await guardarAjustes({ fondoEstilo: 'plano', fondoColores: ['#bae6fd', '#38bdf8', '#1d4ed8'] }, d);
  const copia = await crearCopia(d);
  expect(validarCopia(copia).ok).toBe(true);
  await guardarAjustes({ fondoEstilo: 'animado', fondoColores: null }, d);
  await restaurarCopia(copia, d);
  const a = await d.ajustes.get('ajustes');
  expect(estiloFondo(a)).toBe('plano');
  expect(tonosFondo(a)).toEqual(['#bae6fd', '#38bdf8', '#1d4ed8']);
});

it('rechaza estilos y colores de fondo no válidos, también en copias', async () => {
  await expect(guardarAjustes({ fondoEstilo: 'neon' as never }, d)).rejects.toThrow('fondo');
  await expect(guardarAjustes({ fondoColores: ['#fff', 'red', '#000'] as never }, d)).rejects.toThrow('fondo');
  await expect(guardarAjustes({ fondoColores: ['#ffffff', '#000000'] as never }, d)).rejects.toThrow('fondo');
  const copia = await crearCopia(d);
  (copia.datos.ajustes[0] as { fondoColores: unknown }).fondoColores = ['url(evil)', '#000000', '#000000'];
  expect(validarCopia(copia).ok).toBe(false);
});

it('aclara siempre el fondo para que el texto oscuro se lea encima', () => {
  const negro = ['#000000', '#000000', '#000000'] as [string, string, string];
  for (const tonos of [...PALETAS_FONDO.map((p) => p.tonos), negro]) {
    const [base] = coloresDegradado(tonos);
    expect(luminancia(base)).toBeGreaterThan(0.6);
    expect(luminancia(colorPlano(tonos))).toBeGreaterThan(0.15);
  }
});
