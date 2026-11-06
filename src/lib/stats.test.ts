import { describe, expect, it } from 'vitest';
import { gastoPorCategoria, ordenarMovimientos, resumenMes, ultimosMeses } from './stats';
import { cuenta, mov } from './testdata';

const cuentas = [cuenta('banco'), cuenta('ahorro'), cuenta('empresa', 0, { ambito: 'negocio' })];

describe('resumen del mes', () => {
  // Noviembre: nómina 1.800,00 €, otros 120,00 €; alquiler 650,00 €, súper 84,35 €, cine 15,65 €.
  // Además 300,00 € de banco a ahorro (no es gasto) y un gasto de octubre (no cuenta).
  // Ingresos: 1.920,00 € · Gastos: 750,00 € · Te queda: 1.170,00 €
  const movimientos = [
    mov('ingreso', 180000, '2026-11-01', 'banco', { categoriaId: 'nomina' }),
    mov('ingreso', 12000, '2026-11-04', 'banco', { categoriaId: 'otros-ing' }),
    mov('gasto', 65000, '2026-11-02', 'banco', { categoriaId: 'casa' }),
    mov('gasto', 8435, '2026-11-03', 'banco', { categoriaId: 'comida' }),
    mov('gasto', 1565, '2026-11-04', 'banco', { categoriaId: 'ocio' }),
    mov('transferencia', 30000, '2026-11-05', 'banco', { cuentaDestinoId: 'ahorro' }),
    mov('gasto', 99900, '2026-10-31', 'banco', { categoriaId: 'casa' }),
  ];

  it('suma ingresos y gastos del mes e ignora las transferencias entre cuentas propias', () => {
    expect(resumenMes(movimientos, cuentas, '2026-11')).toEqual({
      mes: '2026-11',
      ingresos: 192000,
      gastos: 75000,
      neto: 117000,
    });
  });

  it('agrupa el gasto por categoría de mayor a menor', () => {
    expect(gastoPorCategoria(movimientos, cuentas, '2026-11')).toEqual([
      { categoriaId: 'casa', importe: 65000 },
      { categoriaId: 'comida', importe: 8435 },
      { categoriaId: 'ocio', importe: 1565 },
    ]);
  });

  it('devuelve los últimos meses aunque estén vacíos', () => {
    const serie = ultimosMeses(movimientos, cuentas, '2026-11', 3);
    expect(serie.map((s) => [s.mes, s.ingresos, s.gastos])).toEqual([
      ['2026-09', 0, 0],
      ['2026-10', 0, 99900],
      ['2026-11', 192000, 75000],
    ]);
  });
});

describe('ámbitos personal y negocio', () => {
  // La empresa cobra 2.000,00 € y paga 30,00 € de software.
  // "Me pago a mí": 1.200,00 € de la cuenta de empresa al banco personal.
  const movimientos = [
    mov('ingreso', 200000, '2026-11-02', 'empresa'),
    mov('gasto', 3000, '2026-11-03', 'empresa'),
    mov('transferencia', 120000, '2026-11-04', 'empresa', { cuentaDestinoId: 'banco' }),
    mov('gasto', 5000, '2026-11-04', 'banco'),
  ];

  it('el gasto del negocio no aparece en lo personal', () => {
    expect(resumenMes(movimientos, cuentas, '2026-11', 'personal').gastos).toBe(5000);
    expect(resumenMes(movimientos, cuentas, '2026-11', 'negocio').gastos).toBe(3000);
  });

  it('pasar dinero del negocio a lo personal es ingreso personal y no gasto del negocio', () => {
    expect(resumenMes(movimientos, cuentas, '2026-11', 'personal').ingresos).toBe(120000);
    expect(resumenMes(movimientos, cuentas, '2026-11', 'negocio')).toEqual({
      mes: '2026-11',
      ingresos: 200000,
      gastos: 3000,
      neto: 197000,
    });
  });
});

describe('orden de movimientos', () => {
  it('ordena por fecha descendente', () => {
    const a = mov('gasto', 1, '2026-11-01', 'banco');
    const b = mov('gasto', 1, '2026-11-03', 'banco');
    const c = mov('gasto', 1, '2026-11-02', 'banco');
    expect(ordenarMovimientos([a, b, c]).map((m) => m.fecha)).toEqual(['2026-11-03', '2026-11-02', '2026-11-01']);
  });
});

describe('orden estable', () => {
  it('dos movimientos del mismo día y la misma hora salen siempre en el mismo orden', () => {
    const a = mov('gasto', 1399, '2026-11-06', 'banco', { id: 'b', creadoEn: '2026-11-06T09:00:00.000Z' });
    const b = mov('gasto', 1099, '2026-11-06', 'banco', { id: 'a', creadoEn: '2026-11-06T09:00:00.000Z' });
    expect(ordenarMovimientos([a, b]).map((m) => m.id)).toEqual(['a', 'b']);
    expect(ordenarMovimientos([b, a]).map((m) => m.id)).toEqual(['a', 'b']);
  });
});
