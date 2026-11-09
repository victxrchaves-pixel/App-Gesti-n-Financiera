import { describe, expect, it } from 'vitest';
import { exentoDel130, finTrimestre, mesesDeCuota, modelo130, modelo303, porcentajeConRetencion } from './impuestos';

const f = (fecha: string, base: number, retencion: number, cobradaEn: string | null = null, tipoIVA = 21) => ({
  fecha,
  lineas: [{ concepto: '', base, tipoIVA }],
  retencion,
  cobradaEn,
});
const g = (fecha: string, base: number, cuotaIVA: number, deducibleIVA: number, deducibleIRPF: number) => ({
  fecha,
  base,
  cuotaIVA,
  deducibleIVA,
  deducibleIRPF,
});

// Un año de ejemplo (céntimos):
// facturas: 10 feb 1.000 € con 15 %; 15 mar 500 € a un particular, sin retención; 5 may 2.000 € con 15 %
// gastos: 20 ene software 100 € + 21 IVA; 14 feb seguro 300 € sin IVA; 10 abr móvil 50 € + 10,50 IVA al 50 %
const facturas = [f('2026-02-10', 100000, 15), f('2026-03-15', 50000, 0), f('2026-05-05', 200000, 15)];
const gastos = [
  g('2026-01-20', 10000, 2100, 100, 100),
  g('2026-02-14', 30000, 0, 0, 100),
  g('2026-04-10', 5000, 1050, 50, 50),
];
const perfil = {
  regimenIVA: 'devengo' as const,
  regimenIRPF: 'simplificada' as const,
  cuotaMensual: 8000,
  fechaAlta: null,
};

describe('modelo 303 (IVA)', () => {
  it('1.er trimestre: IVA de las facturas menos el de los gastos', () => {
    // devengado: 1.500 × 21 % = 315,00 · deducible: 21,00 · a pagar 294,00
    const r = modelo303(facturas, gastos, { anio: 2026, t: 1 }, perfil);
    expect(r.devengado).toEqual([{ tipo: 21, base: 150000, cuota: 31500 }]);
    expect(r).toMatchObject({ ivaDevengado: 31500, ivaDeducible: 2100, compensadoAnterior: 0, resultado: 29400 });
  });

  it('2.º trimestre: 420,00 − 5,25 = 414,75', () => {
    expect(modelo303(facturas, gastos, { anio: 2026, t: 2 }, perfil).resultado).toBe(41475);
  });

  it('un trimestre a favor se compensa en los siguientes', () => {
    // 3T: compro un ordenador (1.000 + 210 IVA) y no facturo → −210,00 a favor
    // 4T: facturo 500 → 105,00 − 210,00 = −105,00 (sigue a favor)
    const mas = {
      facturas: [...facturas, f('2026-10-01', 50000, 15)],
      gastos: [...gastos, g('2026-07-01', 100000, 21000, 100, 100)],
    };
    expect(modelo303(mas.facturas, mas.gastos, { anio: 2026, t: 3 }, perfil).resultado).toBe(-21000);
    const t4 = modelo303(mas.facturas, mas.gastos, { anio: 2026, t: 4 }, perfil);
    expect(t4).toMatchObject({ diferencia: 10500, compensadoAnterior: 21000, resultado: -10500 });
  });

  it('criterio de caja: el IVA cuenta cuando cobras', () => {
    const caja = { ...perfil, regimenIVA: 'caja' as const };
    const conCobro = [f('2026-02-10', 100000, 15, '2026-04-02'), f('2026-03-15', 50000, 0)];
    expect(modelo303(conCobro, [], { anio: 2026, t: 1 }, caja).ivaDevengado).toBe(0);
    expect(modelo303(conCobro, [], { anio: 2026, t: 2 }, caja).ivaDevengado).toBe(21000);
    // La de marzo, si no se cobra, cuenta el 31 de diciembre del año siguiente.
    expect(modelo303(conCobro, [], { anio: 2027, t: 4 }, caja).ivaDevengado).toBe(10500);
  });
});

describe('modelo 130 (pago a cuenta del IRPF)', () => {
  it('1.er trimestre', () => {
    // ingresos 1.500 · gastos 100 + 300 · cuota 3 × 80 = 240 · previo 860 · 5 % = 43
    // rendimiento 1.500 − 683 = 817 · 20 % = 163,40 · retenciones 150 · a pagar 13,40
    expect(modelo130(facturas, gastos, { anio: 2026, t: 1 }, perfil)).toMatchObject({
      ingresos: 150000,
      gastosFacturas: 40000,
      cuotaAutonomos: 24000,
      dificilJustificacion: 4300,
      rendimiento: 81700,
      cuotaBruta: 16340,
      retenciones: 15000,
      pagosAnteriores: 0,
      resultado: 1340,
    });
  });

  it('2.º trimestre: acumulado del año menos lo ya pagado', () => {
    // ingresos 3.500 · gastos 425 · cuota 480 · previo 2.595 · 5 % = 129,75
    // rendimiento 2.465,25 · 20 % = 493,05 · retenciones 450 · pagado 13,40 · a pagar 29,65
    expect(modelo130(facturas, gastos, { anio: 2026, t: 2 }, perfil)).toMatchObject({
      rendimiento: 246525,
      cuotaBruta: 49305,
      retenciones: 45000,
      pagosAnteriores: 1340,
      resultado: 2965,
    });
  });

  it('estimación directa normal: sin el 5 %', () => {
    expect(
      modelo130(facturas, gastos, { anio: 2026, t: 1 }, { ...perfil, regimenIRPF: 'normal' }).dificilJustificacion,
    ).toBe(0);
  });

  it('si las retenciones ya cubren el 20 %, no se paga nada', () => {
    const soloRetenidas = [f('2026-02-10', 100000, 15)];
    // 1.000 − 240 de cuota − 5 % (38) = 722 · 20 % = 144,40 < 150 de retenciones
    expect(modelo130(soloRetenidas, [], { anio: 2026, t: 1 }, perfil).resultado).toBe(0);
  });

  it('cuota de autónomos desde el mes de alta', () => {
    expect(mesesDeCuota({ anio: 2026, t: 1 }, '2026-03-15')).toBe(1);
    expect(mesesDeCuota({ anio: 2026, t: 2 }, '2026-03-15')).toBe(4);
    expect(mesesDeCuota({ anio: 2026, t: 4 }, '2024-06-01')).toBe(12);
    expect(mesesDeCuota({ anio: 2026, t: 1 }, '2026-05-01')).toBe(0);
  });

  it('exento del 130 si el año anterior el 70 % llevó retención', () => {
    const anterior = [f('2025-03-01', 80000, 15), f('2025-06-01', 20000, 0)];
    expect(porcentajeConRetencion(anterior, 2025)).toBe(80);
    expect(exentoDel130(anterior, 2026)).toBe(true);
    expect(exentoDel130([f('2025-03-01', 60000, 15), f('2025-06-01', 40000, 0)], 2026)).toBe(false);
    expect(exentoDel130([], 2026)).toBe(false);
  });

  it('último día de cada trimestre', () => {
    expect(finTrimestre({ anio: 2026, t: 1 })).toBe('2026-03-31');
    expect(finTrimestre({ anio: 2028, t: 1 })).toBe('2028-03-31');
    expect(finTrimestre({ anio: 2026, t: 2 })).toBe('2026-06-30');
  });
});
