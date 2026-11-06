import { describe, expect, it } from 'vitest';
import { datosDesde, formatPct, historialEnRango, precioMedioCompra, variacion } from './mercado';

// Bitcoin, ejemplo hecho a mano: 60.000 € hace 40 días, 64.000 € hace 25, 66.000 € hace 6 y 69.300 € hoy.
const hoy = '2026-11-06';
const historial = [
  { fecha: '2026-09-27', precioEUR: 60000 },
  { fecha: '2026-10-12', precioEUR: 64000 },
  { fecha: '2026-10-31', precioEUR: 66000 },
  { fecha: '2026-11-06', precioEUR: 69300 },
];

describe('mercado por periodos', () => {
  it('recorta el historial al periodo elegido', () => {
    expect(historialEnRango(historial, 7, hoy).map((p) => p.precioEUR)).toEqual([66000, 69300]);
    expect(historialEnRango(historial, 30, hoy).map((p) => p.precioEUR)).toEqual([64000, 66000, 69300]);
    expect(historialEnRango(historial, 365, hoy)).toHaveLength(4);
  });

  it('calcula la subida del periodo: en la última semana, de 66.000 € a 69.300 € es un +5 %', () => {
    const v = variacion(historialEnRango(historial, 7, hoy))!;
    expect(v.cambio).toBe(3300);
    expect(v.pct).toBeCloseTo(5, 10);
    expect(formatPct(v.pct)).toBe('+5,00 %');
    expect(formatPct(-1.3)).toBe('−1,30 %');
  });

  it('con menos de dos puntos no hay variación', () => {
    expect(variacion([{ fecha: hoy, precioEUR: 1 }])).toBeNull();
  });

  it('avisa si el historial no cubre todo el periodo', () => {
    expect(datosDesde(historialEnRango(historial, 365, hoy), 365, hoy)).toBe('2026-09-27');
    expect(datosDesde(historialEnRango(historial, 7, hoy), 7, hoy)).toBeNull();
  });

  it('precio medio de compra: 2.500,00 € por 0,05 BTC son 50.000 € por unidad', () => {
    expect(precioMedioCompra({ coste: 250000, cantidad: 0.05 })).toBeCloseTo(50000, 6);
    expect(precioMedioCompra({ coste: 0, cantidad: 1 })).toBeNull();
  });
});
