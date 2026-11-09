import { describe, expect, it } from 'vitest';
import { beneficioReal, mesesTranscurridos } from './beneficio';

const f = (fecha: string, base: number, retencion: number) => ({
  fecha,
  lineas: [{ concepto: '', base, tipoIVA: 21 }],
  retencion,
  cobradaEn: null,
});
const perfil = {
  regimenIVA: 'devengo' as const,
  regimenIRPF: 'simplificada' as const,
  cuotaMensual: 8000,
  fechaAlta: null,
  reservaIRPF: 20,
};
const cuentas = [
  { id: 'neg', ambito: 'negocio' as const },
  { id: 'per', ambito: 'personal' as const },
];
const transferencia = (fecha: string, importe: number, de: string, a: string) => ({
  tipo: 'transferencia' as const,
  fecha,
  importe,
  cuentaId: de,
  cuentaDestinoId: a,
});

// Hoy, 9 de noviembre de 2026. Facturas con 15 % de retención: julio 1.800 €, octubre 2.400 €, noviembre 1.200 €.
// Un gasto de software de 60 € + 12,60 € de IVA. Te pasaste 1.000 € en septiembre y metiste 200 € en febrero.
const datos = {
  facturas: [f('2026-07-15', 180000, 15), f('2026-10-05', 240000, 15), f('2026-11-03', 120000, 15)],
  gastos: [{ fecha: '2026-10-12', base: 6000, cuotaIVA: 1260, deducibleIVA: 100, deducibleIRPF: 100 }],
  cuentas,
  movimientos: [transferencia('2026-09-01', 100000, 'neg', 'per'), transferencia('2026-02-01', 20000, 'per', 'neg')],
  dineroNegocio: 300000,
};

describe('beneficio real y «Me pago a mí» (ejemplo hecho a mano)', () => {
  it('cuánto ganas y cuánto puedes pasarte', () => {
    const r = beneficioReal(datos, perfil, '2026-11-09');
    // ingresos 5.400 · gastos 60 · cuota 11 meses × 80 = 880 · beneficio 4.460
    expect(r).toMatchObject({ ingresos: 540000, gastos: 6000, cuota: 88000, beneficio: 446000, retenciones: 81000 });
    // IRPF: 20 % de 4.460 = 892 − 810 retenidos = 82
    expect(r.irpfReservar).toBe(8200);
    // IVA del 4.º trimestre (el 3.º ya terminó su plazo): (2.400 + 1.200) × 21 % − 12,60 = 743,40
    expect(r.ivaPendiente).toBe(74340);
    // Ya te pasaste 1.000 − 200 = 800
    expect(r.yaTePagaste).toBe(80000);
    // Por beneficio: 4.460 − 82 − 800 = 3.578 · Por la cuenta: 3.000 − 743,40 − 82 = 2.174,60
    expect(r).toMatchObject({ porBeneficio: 357800, porCaja: 217460, puedesPasarte: 217460, limita: 'caja' });
  });

  it('con más dinero en la cuenta, el límite es el beneficio', () => {
    const r = beneficioReal({ ...datos, dineroNegocio: 600000 }, perfil, '2026-11-09');
    expect(r).toMatchObject({ puedesPasarte: 357800, limita: 'beneficio' });
  });

  it('en pérdidas no se propone nada', () => {
    const r = beneficioReal({ ...datos, facturas: [] }, perfil, '2026-11-09');
    expect(r.beneficio).toBe(-94000);
    expect(r).toMatchObject({ irpfReservar: 0, porBeneficio: 0, puedesPasarte: 0 });
  });

  it('meses con cuota', () => {
    expect(mesesTranscurridos('2026-11-09', null)).toBe(11);
    expect(mesesTranscurridos('2026-11-09', '2026-09-15')).toBe(3);
    expect(mesesTranscurridos('2026-11-09', '2024-01-01')).toBe(11);
    expect(mesesTranscurridos('2026-11-09', '2026-12-01')).toBe(0);
  });
});
