import { describe, expect, it } from 'vitest';
import type { Factura, GastoNegocio } from '../db/types';
import { csvFacturas, csvGastos, importeCSV } from './exportar';

const factura: Factura = {
  id: 'f1',
  numero: '2026-001',
  fecha: '2026-10-05',
  vencimiento: '2026-11-04',
  clienteId: 'c1',
  clienteNombre: 'Estudio "Norte"; SL',
  lineas: [
    { concepto: 'Diseño', base: 100000, tipoIVA: 21 },
    { concepto: 'Libro', base: 5000, tipoIVA: 4 },
  ],
  retencion: 15,
  nota: '',
  cobradaEn: '2026-10-20',
  movimientoId: null,
  creadaEn: '',
  actualizadaEn: '',
};

describe('exportar a CSV para el gestor', () => {
  it('importes con coma decimal y sin separador de miles', () => {
    expect(importeCSV(123456)).toBe('1234,56');
    expect(importeCSV(-525)).toBe('-5,25');
    expect(importeCSV(0)).toBe('0,00');
  });

  it('facturas: una línea por tipo de IVA, retención y total en la primera', () => {
    const csv = csvFacturas([factura], new Map([['c1', 'B12345678']]));
    expect(csv.startsWith('﻿')).toBe(true);
    const lineas = csv.slice(1).trim().split('\r\n');
    expect(lineas).toHaveLength(3);
    // 1.000 × 21 % = 210 · 50 × 4 % = 2 · retención 15 % de 1.050 = 157,50 · total 1.050 + 212 − 157,50 = 1.104,50
    expect(lineas[1]).toBe(
      '2026-001;05/10/2026;"Estudio ""Norte""; SL";B12345678;Diseño · Libro;1000,00;21;210,00;15;157,50;1104,50;20/10/2026',
    );
    expect(lineas[2]).toBe('2026-001;05/10/2026;"Estudio ""Norte""; SL";B12345678;Diseño · Libro;50,00;4;2,00;;;;');
  });

  it('gastos: lo deducible y, con el equipo caro, solo lo que toca al periodo', () => {
    const pc: GastoNegocio = {
      id: 'g1',
      fecha: '2026-07-01',
      proveedor: 'Apple',
      numero: '',
      concepto: 'Portátil',
      categoria: 'equipo',
      base: 120000,
      tipoIVA: 21,
      cuotaIVA: 25200,
      deducibleIVA: 100,
      deducibleIRPF: 100,
      amortizacion: 26,
      cuentaId: 'n1',
      movimientoId: null,
      nota: '',
      creadoEn: '',
      actualizadoEn: '',
    };
    const csv = csvGastos([pc], new Map([['n1', { nombre: 'Cuenta negocio' }]]), '2026-07-01', '2026-09-30');
    const linea = csv.slice(1).trim().split('\r\n')[1];
    expect(linea).toBe(
      '01/07/2026;Apple;;Portátil;Equipo e informática;1200,00;21;252,00;1452,00;100;252,00;100;78,64;26;Cuenta negocio',
    );
  });
});
