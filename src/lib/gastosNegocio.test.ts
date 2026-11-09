import { describe, expect, it } from 'vitest';
import {
  afectacionVivienda,
  cifrasGasto,
  deduciblesSugeridos,
  desglosarTotal,
  resumirGastos,
  validarGastoNegocio,
  type DatosGastoNegocio,
} from './gastosNegocio';

describe('cifras de un gasto (ejemplos hechos a mano)', () => {
  it('software al 100 %: se deduce todo el IVA y la base', () => {
    // 40,00 + 21 % = 8,40 → total 48,40 · IVA deducible 8,40 · IRPF 40,00
    expect(cifrasGasto({ base: 4000, cuotaIVA: 840, deducibleIVA: 100, deducibleIRPF: 100 })).toEqual({
      total: 4840,
      ivaDeducible: 840,
      gastoIRPF: 4000,
    });
  });

  it('móvil de uso mixto al 50 %: la mitad del IVA y la mitad de la base', () => {
    // 50,00 + 10,50 IVA · IVA deducible 5,25 · IRPF 25,00 (el IVA del negocio ya se deduce en el 303)
    expect(cifrasGasto({ base: 5000, cuotaIVA: 1050, deducibleIVA: 50, deducibleIRPF: 50 })).toEqual({
      total: 6050,
      ivaDeducible: 525,
      gastoIRPF: 2500,
    });
  });

  it('gasolina: 50 % del IVA y nada en el IRPF', () => {
    // 60,00 + 12,60 · IVA deducible 6,30 · IRPF 0
    expect(cifrasGasto({ base: 6000, cuotaIVA: 1260, deducibleIVA: 50, deducibleIRPF: 0 })).toEqual({
      total: 7260,
      ivaDeducible: 630,
      gastoIRPF: 0,
    });
  });

  it('coche de uso exclusivo: el IVA que no se deduce cuenta como gasto en el IRPF', () => {
    // 100,00 + 21,00 · IVA deducible 10,50 · IRPF 100,00 + 10,50 = 110,50
    expect(cifrasGasto({ base: 10000, cuotaIVA: 2100, deducibleIVA: 50, deducibleIRPF: 100 }).gastoIRPF).toBe(11050);
  });

  it('seguro sin IVA: solo cuenta en el IRPF', () => {
    expect(cifrasGasto({ base: 18000, cuotaIVA: 0, deducibleIVA: 0, deducibleIRPF: 100 })).toEqual({
      total: 18000,
      ivaDeducible: 0,
      gastoIRPF: 18000,
    });
  });

  it('resume varios gastos', () => {
    const r = resumirGastos([
      { base: 4000, cuotaIVA: 840, deducibleIVA: 100, deducibleIRPF: 100 },
      { base: 5000, cuotaIVA: 1050, deducibleIVA: 50, deducibleIRPF: 50 },
    ]);
    expect(r).toEqual({ gastos: 2, base: 9000, total: 10890, ivaDeducible: 1365, gastoIRPF: 6500 });
  });
});

describe('trabajo desde casa', () => {
  it('parte de la vivienda dedicada a trabajar', () => {
    expect(afectacionVivienda({ metrosVivienda: 80, metrosTrabajo: 12 })).toBe(15);
    expect(afectacionVivienda({ metrosVivienda: 90, metrosTrabajo: 10 })).toBe(11.11);
    expect(afectacionVivienda({ metrosVivienda: null, metrosTrabajo: 10 })).toBe(0);
  });
  it('suministros: el 30 % de esa parte', () => {
    // 30 % × 15 % = 4,5 %
    expect(deduciblesSugeridos('casa', { metrosVivienda: 80, metrosTrabajo: 12 })).toEqual({ iva: 4.5, irpf: 4.5 });
    expect(deduciblesSugeridos('casa', {})).toEqual({ iva: 0, irpf: 0 });
    expect(deduciblesSugeridos('vehiculo', {})).toEqual({ iva: 50, irpf: 0 });
  });
});

describe('importe con IVA incluido', () => {
  it('saca la base y el IVA y suman exactamente el total', () => {
    // 121,00 al 21 % → 100,00 + 21,00
    expect(desglosarTotal(12100, 21)).toEqual({ base: 10000, cuotaIVA: 2100 });
    // 10,00 al 21 % → 8,26 + 1,74
    expect(desglosarTotal(1000, 21)).toEqual({ base: 826, cuotaIVA: 174 });
    // 33,00 de comida al 10 % → 30,00 + 3,00
    expect(desglosarTotal(3300, 10)).toEqual({ base: 3000, cuotaIVA: 300 });
    expect(desglosarTotal(5000, 0)).toEqual({ base: 5000, cuotaIVA: 0 });
  });
});

describe('validarGastoNegocio', () => {
  const ok: DatosGastoNegocio = {
    fecha: '2026-11-02',
    proveedor: 'Adobe',
    numero: '',
    concepto: 'Creative Cloud',
    categoria: 'software',
    base: 4000,
    tipoIVA: 21,
    cuotaIVA: 840,
    deducibleIVA: 100,
    deducibleIRPF: 100,
    cuentaId: null,
    nota: '',
  };
  it('acepta un gasto completo y el céntimo de los tickets', () => {
    expect(validarGastoNegocio(ok)).toBeNull();
    expect(validarGastoNegocio({ ...ok, cuotaIVA: 841 })).toBeNull();
  });
  it('rechaza lo que no cuadra', () => {
    expect(validarGastoNegocio({ ...ok, proveedor: ' ' })).toMatch(/quién/);
    expect(validarGastoNegocio({ ...ok, categoria: 'x' })).toMatch(/categoría/);
    expect(validarGastoNegocio({ ...ok, base: 0 })).toMatch(/base/);
    expect(validarGastoNegocio({ ...ok, cuotaIVA: 400 })).toMatch(/no cuadra/);
    expect(validarGastoNegocio({ ...ok, deducibleIRPF: 120 })).toMatch(/0 a 100/);
  });
});
