import { describe, expect, it } from 'vitest';
import { flujoMes, grupoCuenta, patrimonioMensual, saldoEnFecha, serieSaldoDiaria, ultimoMovimiento } from './cuentas';
import { cuenta, mov } from './testdata';

// Ejemplo hecho a mano. El banco empieza con 1.000 €; el ahorro general con 2.000 € y una meta dentro.
// Septiembre: nómina 1.800 € (día 1), alquiler 650 € (día 2).
// Octubre: nómina 1.800 € (1), súper 120 € (5), 300 € del banco al ahorro (10), 200 € del ahorro a la meta (11).
// Noviembre: gasto de 50 € (3).
const banco = cuenta('banco', 100000);
const ahorro = cuenta('ahorro', 200000, { tipo: 'ahorro', ahorroGeneral: true });
const meta = cuenta('meta', 0, { tipo: 'ahorro', cuentaPadreId: 'ahorro', bolsilloMetaId: 'm1' });
const cuentas = [banco, ahorro, meta];
const movs = [
  mov('ingreso', 180000, '2026-09-01', 'banco'),
  mov('gasto', 65000, '2026-09-02', 'banco'),
  mov('ingreso', 180000, '2026-10-01', 'banco'),
  mov('gasto', 12000, '2026-10-05', 'banco'),
  mov('transferencia', 30000, '2026-10-10', 'banco', { cuentaDestinoId: 'ahorro' }),
  mov('transferencia', 20000, '2026-10-11', 'ahorro', { cuentaDestinoId: 'meta' }),
  mov('gasto', 5000, '2026-11-03', 'banco'),
];
const hoy = '2026-11-06';

describe('saldos de una cuenta en el tiempo', () => {
  it('el ahorro visible incluye las metas que lleva dentro', () => {
    expect(grupoCuenta('ahorro', cuentas)).toEqual(['ahorro', 'meta']);
    // 2.000 + 300 = 2.300 € (los 200 € de la meta siguen dentro del ahorro)
    expect(saldoEnFecha(grupoCuenta('ahorro', cuentas), cuentas, movs, hoy)).toBe(230000);
  });

  it('saldo del banco en cada fecha: 1.000 → 2.800 → 2.150 → … → 3.480 → 3.430 €', () => {
    expect(saldoEnFecha(['banco'], cuentas, movs, '2026-08-31')).toBe(100000);
    expect(saldoEnFecha(['banco'], cuentas, movs, '2026-09-30')).toBe(215000);
    // 2.150 + 1.800 − 120 − 300 = 3.530 €
    expect(saldoEnFecha(['banco'], cuentas, movs, '2026-10-31')).toBe(353000);
    expect(saldoEnFecha(['banco'], cuentas, movs, hoy)).toBe(348000);
  });

  it('la serie diaria arrastra el saldo y cambia el día del movimiento', () => {
    const serie = serieSaldoDiaria(['banco'], cuentas, movs, '2026-11-01', hoy);
    expect(serie.map((p) => p.valor)).toEqual([353000, 353000, 348000, 348000, 348000, 348000]);
  });

  it('el patrimonio de cada mes suma banco y ahorro al cierre (el mes actual, hasta hoy)', () => {
    // Septiembre: 2.150 + 2.000 = 4.150 €. Octubre: 3.530 + 2.300 = 5.830 €. Noviembre: 3.480 + 2.300 = 5.780 €.
    expect(patrimonioMensual(cuentas, movs, '2026-11', 3, hoy)).toEqual([
      { mes: '2026-09', valor: 415000 },
      { mes: '2026-10', valor: 583000 },
      { mes: '2026-11', valor: 578000 },
    ]);
  });
});

describe('lo que entra y sale', () => {
  it('cuenta ingresos, gastos y traspasos con otras cuentas, no los internos', () => {
    // Banco en octubre: entra 1.800 €; salen 120 € + 300 € = 420 €.
    expect(flujoMes(['banco'], movs, '2026-10', hoy)).toEqual({ entradas: 180000, salidas: 42000, neto: 138000 });
    // Ahorro en octubre: entran 300 € del banco; los 200 € a la meta no salen del ahorro.
    expect(flujoMes(grupoCuenta('ahorro', cuentas), movs, '2026-10', hoy)).toEqual({
      entradas: 30000,
      salidas: 0,
      neto: 30000,
    });
  });

  it('el último movimiento del ahorro es el traspaso desde el banco, no el reparto interno', () => {
    expect(ultimoMovimiento(grupoCuenta('ahorro', cuentas), movs, hoy)?.fecha).toBe('2026-10-10');
    expect(ultimoMovimiento(['banco'], movs, hoy)?.fecha).toBe('2026-11-03');
  });
});
