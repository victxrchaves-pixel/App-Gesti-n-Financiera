import { describe, expect, it } from 'vitest';
import { esRepartoInterno, patrimonio, saldosPorCuenta } from './balances';
import { cuenta, mov } from './testdata';

describe('saldos', () => {
  // Ejemplo hecho a mano:
  // Banco empieza con 1.000,00 €; cobra la nómina de 1.800,00 €, paga 650,00 € de alquiler
  // y pasa 300,00 € a Ahorro. Efectivo empieza con 50,00 € y gasta 12,40 €.
  // Banco: 1.000 + 1.800 − 650 − 300 = 1.850,00 €
  // Ahorro: 2.000 + 300 = 2.300,00 €
  // Efectivo: 50 − 12,40 = 37,60 €
  // Patrimonio: 1.850 + 2.300 + 37,60 = 4.187,60 €
  const cuentas = [cuenta('banco', 100000), cuenta('ahorro', 200000), cuenta('efectivo', 5000)];
  const movimientos = [
    mov('ingreso', 180000, '2026-11-01', 'banco'),
    mov('gasto', 65000, '2026-11-02', 'banco'),
    mov('transferencia', 30000, '2026-11-03', 'banco', { cuentaDestinoId: 'ahorro' }),
    mov('gasto', 1240, '2026-11-03', 'efectivo'),
  ];

  it('calcula el saldo de cada cuenta', () => {
    const s = saldosPorCuenta(cuentas, movimientos);
    expect(s.get('banco')).toBe(185000);
    expect(s.get('ahorro')).toBe(230000);
    expect(s.get('efectivo')).toBe(3760);
  });

  it('el patrimonio es la suma de las cuentas y las transferencias no lo cambian', () => {
    expect(patrimonio(cuentas, movimientos)).toBe(418760);
  });

  it('no cuenta las cuentas archivadas', () => {
    const conArchivada = [...cuentas, cuenta('vieja', 99900, { archivada: true })];
    expect(patrimonio(conArchivada, movimientos)).toBe(418760);
  });

  it('separa el patrimonio por ámbito', () => {
    const conNegocio = [...cuentas, cuenta('negocio', 500000, { ambito: 'negocio' })];
    expect(patrimonio(conNegocio, movimientos, 'personal')).toBe(418760);
    expect(patrimonio(conNegocio, movimientos, 'negocio')).toBe(500000);
    expect(patrimonio(conNegocio, movimientos)).toBe(918760);
  });

  it('admite saldos iniciales negativos (por ejemplo, una tarjeta de crédito)', () => {
    const s = saldosPorCuenta([cuenta('tarjeta', -25000)], [mov('gasto', 1000, '2026-11-01', 'tarjeta')]);
    expect(s.get('tarjeta')).toBe(-26000);
  });
});

describe('repartos internos del ahorro', () => {
  // «Ahorro» es la cuenta visible; «Meta · Japón» y «Meta · Colchón» son sus bolsillos internos.
  const ahorro = cuenta('ahorro', 0, { tipo: 'ahorro', ahorroGeneral: true });
  const japon = cuenta('japon', 0, { tipo: 'ahorro', cuentaPadreId: 'ahorro', bolsilloMetaId: 'm1' });
  const colchon = cuenta('colchon', 0, { tipo: 'ahorro', cuentaPadreId: 'ahorro', bolsilloMetaId: 'm2' });
  const mapa = new Map([cuenta('banco'), ahorro, japon, colchon].map((c) => [c.id, c]));

  it('pasar dinero del ahorro general a una meta, o de una meta a otra, es interno', () => {
    expect(
      esRepartoInterno(mov('transferencia', 500, '2026-11-01', 'ahorro', { cuentaDestinoId: 'japon' }), mapa),
    ).toBe(true);
    expect(
      esRepartoInterno(mov('transferencia', 500, '2026-11-01', 'japon', { cuentaDestinoId: 'colchon' }), mapa),
    ).toBe(true);
  });

  it('aportar desde el banco a una meta no es interno: cambia el saldo del banco', () => {
    expect(esRepartoInterno(mov('transferencia', 500, '2026-11-01', 'banco', { cuentaDestinoId: 'japon' }), mapa)).toBe(
      false,
    );
    expect(esRepartoInterno(mov('gasto', 500, '2026-11-01', 'japon'), mapa)).toBe(false);
  });
});
