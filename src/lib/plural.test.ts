import { describe, expect, it } from 'vitest';
import { contar } from './plural';

describe('contar', () => {
  it('usa el singular solo para uno', () => {
    expect(contar(1, 'posición tiene', 'posiciones tienen')).toBe('1 posición tiene');
    expect(contar(0, 'presupuesto copiado', 'presupuestos copiados')).toBe('0 presupuestos copiados');
    expect(contar(2, 'movimiento', 'movimientos')).toBe('2 movimientos');
  });
  it('agrupa los miles con punto', () => {
    expect(contar(12840, 'movimiento', 'movimientos')).toBe('12.840 movimientos');
  });
});
