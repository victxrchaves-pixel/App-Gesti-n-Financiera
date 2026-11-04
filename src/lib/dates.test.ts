import { describe, expect, it } from 'vitest';
import { addDays, addMonths, dayHeader, greeting, isISODate, lastMonths, longDate, monthLabel, shortDate } from './dates';

describe('fechas', () => {
  it('suma meses cruzando años', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-03', -14)).toBe('2025-01');
  });
  it('devuelve los últimos 6 meses en orden', () => {
    expect(lastMonths('2026-02', 6)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('suma días con cambios de mes y año bisiesto', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('valida fechas', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('4/11/2026')).toBe(false);
  });
  it('escribe fechas en castellano', () => {
    expect(longDate('2026-11-04')).toBe('miércoles, 4 de noviembre');
    expect(monthLabel('2026-11')).toBe('noviembre de 2026');
    expect(shortDate('2026-11-04', '2026-11-04')).toBe('4 nov');
    expect(shortDate('2025-12-24', '2026-11-04')).toBe('24 dic 2025');
    expect(dayHeader('2026-11-04', '2026-11-04')).toBe('Hoy');
    expect(dayHeader('2026-11-03', '2026-11-04')).toBe('Ayer');
    expect(dayHeader('2026-11-02', '2026-11-04')).toBe('Lunes, 2 de noviembre');
  });
  it('saluda según la hora', () => {
    expect(greeting(3)).toBe('Buenas noches');
    expect(greeting(9)).toBe('Buenos días');
    expect(greeting(14)).toBe('Buenas tardes');
    expect(greeting(22)).toBe('Buenas noches');
  });
});
