import { describe, expect, it } from 'vitest';
import { centsToInput, formatMoney, parseMoney, porcentaje, sumCents } from './money';

const E = ' €';

describe('formatMoney', () => {
  it('formatea en español con miles y decimales', () => {
    expect(formatMoney(123456)).toBe(`1.234,56${E}`);
    expect(formatMoney(0)).toBe(`0,00${E}`);
    expect(formatMoney(5)).toBe(`0,05${E}`);
    expect(formatMoney(100000000)).toBe(`1.000.000,00${E}`);
  });
  it('agrupa también los números de cuatro cifras', () => {
    // Intl.NumberFormat('es-ES') daría "1234,56 €"; queremos "1.234,56 €".
    expect(formatMoney(123400)).toBe(`1.234,00${E}`);
  });
  it('gestiona el signo', () => {
    expect(formatMoney(-2550)).toBe(`−25,50${E}`);
    expect(formatMoney(2550, { signo: 'siempre' })).toBe(`+25,50${E}`);
    expect(formatMoney(-2550, { signo: 'nunca' })).toBe(`25,50${E}`);
  });
  it('puede omitir símbolo y céntimos a cero', () => {
    expect(formatMoney(150000, { simbolo: false, sinCentimosSiCero: true })).toBe('1.500');
    expect(formatMoney(150050, { sinCentimosSiCero: true })).toBe(`1.500,50${E}`);
  });
  it('rechaza importes que no son céntimos enteros', () => {
    expect(() => formatMoney(12.5)).toThrow();
  });
});

describe('parseMoney', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['12,5', 1250],
    ['12.5', 1250],
    ['12', 1200],
    ['0,99', 99],
    [',5', 50],
    ['12.500', 1250000],
    ['1.234.567,89', 123456789],
    ['1,234.56', 123456],
    ['  45,00 € ', 4500],
    ['-12,50', -1250],
    ['−12,50', -1250],
    ['12,50-', -1250],
    ['+3', 300],
    ['1,005', 101],
    ['1,004', 100],
  ])('"%s" → %i céntimos', (texto, esperado) => {
    expect(parseMoney(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '12,34,56', '1.23.4', '€', '12a', '1.2345,00'])('"%s" no es un importe', (texto) => {
    expect(parseMoney(texto)).toBeNull();
  });

  it('ida y vuelta con centsToInput', () => {
    for (const c of [0, 1, 99, 100, 123456, -98765]) expect(parseMoney(centsToInput(c))).toBe(c);
  });
});

describe('sumas y porcentajes', () => {
  it('suma céntimos sin errores de coma flotante', () => {
    // 0,10 + 0,20 en euros con decimales daría 0,30000000000000004
    expect(sumCents([10, 20])).toBe(30);
  });
  it('calcula porcentajes redondeados', () => {
    expect(porcentaje(8000, 10000)).toBe(80);
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(5, 0)).toBe(0);
  });
});
