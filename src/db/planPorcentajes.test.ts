import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NetoDB } from './db';
import { aplicarPlanPorcentajes, guardarPresupuesto } from './budgets';
import { completarInicio } from './repo';
import {
  ingresoSugerido,
  limitesPlan,
  plantillaPorId,
  porcentajesIniciales,
  porcentajeValido,
  resumenPlan,
} from '../lib/planPorcentajes';
import { cuenta, mov } from '../lib/testdata';
import type { Categoria } from './types';

let d: NetoDB;
let n = 0;
let cats: Categoria[];
const id = (nombre: string) => cats.find((c) => c.nombre === nombre)!.id;
beforeEach(async () => {
  d = new NetoDB('plan-' + ++n);
  await completarInicio({ nombre: 'Victor', autonomo: false }, d);
  cats = await d.categorias.toArray();
});
afterEach(async () => {
  await d.delete();
});

describe('reparto por porcentajes', () => {
  // Ejemplo hecho a mano: ingresas 2.000,00 € al mes con el reparto Equilibrado (50/30/20).
  // Casa 30 % = 600 €, Comida 12 % = 240 €, Transporte 6 % = 120 €, Salud 2 % = 40 €,
  // Ocio 10 % = 200 €, Ropa 5 % = 100 €, Suscripciones 5 % = 100 €, Otros 10 % = 200 €.
  // Gastos: 1.600 € (80 %). Para ahorrar: 400 € (20 %).
  it('reparte el ingreso entre las categorías según la plantilla', () => {
    const pct = porcentajesIniciales(plantillaPorId('equilibrado'), cats);
    const limites = new Map(limitesPlan(200000, pct).map((l) => [l.categoriaId, l.limite]));
    expect(limites.get(id('Casa'))).toBe(60000);
    expect(limites.get(id('Comida'))).toBe(24000);
    expect(limites.get(id('Transporte'))).toBe(12000);
    expect(limites.get(id('Salud'))).toBe(4000);
    expect(limites.get(id('Ocio'))).toBe(20000);
    expect(limites.get(id('Ropa'))).toBe(10000);
    expect(limites.get(id('Suscripciones'))).toBe(10000);
    expect(limites.get(id('Otros'))).toBe(20000);
    expect(resumenPlan(200000, pct)).toEqual({
      pctGasto: 80,
      pctAhorro: 20,
      gasto: 160000,
      ahorro: 40000,
      error: null,
    });
  });

  it('avisa si el reparto pasa del 100 % y redondea a céntimos', () => {
    const pct = new Map([
      [id('Casa'), 70],
      [id('Ocio'), 40],
    ]);
    expect(resumenPlan(100000, pct).error).toContain('100 %');
    // 1.234,57 € × 12,5 % = 154,32125 € → 154,32 €
    expect(limitesPlan(123457, new Map([[id('Comida'), 12.5]]))).toEqual([
      { categoriaId: id('Comida'), limite: 15432 },
    ]);
  });

  it('acepta porcentajes con un decimal entre 0 y 100', () => {
    expect(porcentajeValido('12,5')).toBe(12.5);
    expect(porcentajeValido('')).toBe(0);
    expect(porcentajeValido('101')).toBeNull();
    expect(porcentajeValido('abc')).toBeNull();
  });

  it('crea el presupuesto del mes y sustituye los límites que hubiera', async () => {
    await guardarPresupuesto(
      { mes: '2026-11', categoriaId: id('Ocio'), limite: 99900, color: '#123456' },
      undefined,
      d,
    );
    await guardarPresupuesto({ mes: '2026-11', categoriaId: id('Ropa'), limite: 5000 }, undefined, d);
    await aplicarPlanPorcentajes(
      '2026-11',
      [
        { categoriaId: id('Ocio'), limite: 20000 },
        { categoriaId: id('Casa'), limite: 60000 },
      ],
      d,
    );
    const mes = await d.presupuestos.where('mes').equals('2026-11').toArray();
    expect(mes.map((p) => [cats.find((c) => c.id === p.categoriaId)!.nombre, p.limite]).sort()).toEqual([
      ['Casa', 60000],
      ['Ocio', 20000],
    ]);
    // El color propio de Ocio se conserva al sustituir su límite.
    expect(mes.find((p) => p.categoriaId === id('Ocio'))?.color).toBe('#123456');
  });
});

describe('ingreso sugerido', () => {
  // Septiembre 2.000 €, octubre 2.200 € y noviembre (mes en curso) 500 € → media de sep y oct: 2.100 €.
  it('usa la media de los últimos meses completos con ingresos', () => {
    const cuentas = [cuenta('banco')];
    const movs = [
      mov('ingreso', 200000, '2026-09-01', 'banco'),
      mov('ingreso', 220000, '2026-10-01', 'banco'),
      mov('ingreso', 50000, '2026-11-02', 'banco'),
    ];
    expect(ingresoSugerido(movs, cuentas, '2026-11-06')).toBe(210000);
  });
  it('sin meses completos, usa lo ingresado este mes', () => {
    expect(ingresoSugerido([mov('ingreso', 180000, '2026-11-01', 'banco')], [cuenta('banco')], '2026-11-06')).toBe(
      180000,
    );
  });
});
