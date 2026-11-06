import { describe, expect, it } from 'vitest';
import {
  aplicarPorcentaje,
  estadoFactura,
  moverTrimestre,
  perfilNegocio,
  resumirFacturas,
  retencionSugerida,
  siguienteNumero,
  totalesFactura,
  trimestreDe,
  validarFactura,
  type DatosFactura,
} from './facturas';

describe('totalesFactura (ejemplos hechos a mano)', () => {
  it('factura profesional típica: 1.000 € + 21 % IVA − 15 % IRPF', () => {
    // 1.000,00 × 21 % = 210,00 · 1.000,00 × 15 % = 150,00 · total = 1.000 + 210 − 150 = 1.060,00
    const t = totalesFactura([{ concepto: 'Diseño web', base: 100000, tipoIVA: 21 }], 15);
    expect(t).toEqual({
      base: 100000,
      porTipo: [{ tipo: 21, base: 100000, cuota: 21000 }],
      iva: 21000,
      retencion: 15000,
      total: 106000,
    });
  });

  it('agrupa el IVA por tipo y redondea sobre la base de cada tipo', () => {
    // 21 %: 100,00 + 33,33 = 133,33 → 27,9993 → 28,00 · 10 %: 50,00 → 5,00
    // base 183,33 · retención 15 % = 27,4995 → 27,50 · total 183,33 + 33,00 − 27,50 = 188,83
    const t = totalesFactura(
      [
        { concepto: 'Horas', base: 10000, tipoIVA: 21 },
        { concepto: 'Libro', base: 5000, tipoIVA: 10 },
        { concepto: 'Extra', base: 3333, tipoIVA: 21 },
      ],
      15,
    );
    expect(t.porTipo).toEqual([
      { tipo: 21, base: 13333, cuota: 2800 },
      { tipo: 10, base: 5000, cuota: 500 },
    ]);
    expect(t.iva).toBe(3300);
    expect(t.retencion).toBe(2750);
    expect(t.total).toBe(18883);
  });

  it('el medio céntimo sube: 0,50 € × 21 % = 0,105 € → 0,11 €', () => {
    expect(aplicarPorcentaje(50, 21)).toBe(11);
    expect(aplicarPorcentaje(250, 7)).toBe(18); // 17,5 céntimos → 18
  });

  it('factura exenta y sin retención: el total es la base', () => {
    const t = totalesFactura([{ concepto: 'Formación reglada', base: 45000, tipoIVA: 0 }], 0);
    expect(t).toMatchObject({ base: 45000, iva: 0, retencion: 0, total: 45000 });
  });

  it('resume varias facturas sumando cada total', () => {
    const r = resumirFacturas([
      { lineas: [{ concepto: 'A', base: 100000, tipoIVA: 21 }], retencion: 15 },
      { lineas: [{ concepto: 'B', base: 20000, tipoIVA: 21 }], retencion: 0 },
    ]);
    // A: 1.060,00 · B: 200 + 42 = 242,00
    expect(r).toEqual({ facturas: 2, base: 120000, iva: 25200, retencion: 15000, total: 130200 });
  });
});

describe('retencionSugerida', () => {
  const base = perfilNegocio();
  it('actividad empresarial: sin retención', () => {
    expect(retencionSugerida({ ...base, actividad: 'empresarial' }, '2026-05-10')).toBe(0);
  });
  it('profesional: 15 %', () => {
    expect(retencionSugerida(base, '2026-05-10')).toBe(15);
  });
  it('nuevo autónomo: 7 % el año de alta y los dos siguientes, luego 15 %', () => {
    const nuevo = { ...base, nuevoAutonomo: true, fechaAlta: '2025-03-01' };
    expect(retencionSugerida(nuevo, '2025-12-31')).toBe(7);
    expect(retencionSugerida(nuevo, '2027-06-01')).toBe(7);
    expect(retencionSugerida(nuevo, '2028-01-02')).toBe(15);
  });
  it('nuevo autónomo sin fecha de alta: 7 %', () => {
    expect(retencionSugerida({ ...base, nuevoAutonomo: true }, '2026-01-10')).toBe(7);
  });
});

describe('siguienteNumero', () => {
  it('sin facturas: AAAA-001', () => {
    expect(siguienteNumero([], 2026)).toBe('2026-001');
  });
  it('sigue la serie del año y respeta los ceros', () => {
    expect(siguienteNumero(['2026-001', '2026-009', '2026-002'], 2026)).toBe('2026-010');
    expect(siguienteNumero(['F2026/7', 'F2026/12'], 2026)).toBe('F2026/13');
  });
  it('con el año al final, el contador es el de antes', () => {
    expect(siguienteNumero(['014/2026', '015/2026'], 2026)).toBe('016/2026');
  });
  it('año nuevo: empieza la serie con el mismo formato', () => {
    expect(siguienteNumero(['2025-087', '2025-088'], 2026)).toBe('2026-001');
    expect(siguienteNumero(['088/2025'], 2026)).toBe('001/2026');
  });
  it('numeración sin año: sigue contando', () => {
    expect(siguienteNumero(['37', '38', 'A-0099'], 2026)).toBe('A-0100');
  });
});

describe('estado y trimestres', () => {
  it('pendiente, vencida y cobrada', () => {
    expect(estadoFactura({ cobradaEn: null, vencimiento: '2026-11-06' }, '2026-11-06')).toBe('pendiente');
    expect(estadoFactura({ cobradaEn: null, vencimiento: '2026-11-05' }, '2026-11-06')).toBe('vencida');
    expect(estadoFactura({ cobradaEn: '2026-11-01', vencimiento: '2026-10-01' }, '2026-11-06')).toBe('cobrada');
  });
  it('trimestre de una fecha y movimiento entre trimestres', () => {
    expect(trimestreDe('2026-03-31')).toEqual({ anio: 2026, t: 1 });
    expect(trimestreDe('2026-04-01')).toEqual({ anio: 2026, t: 2 });
    expect(trimestreDe('2026-12-31')).toEqual({ anio: 2026, t: 4 });
    expect(moverTrimestre({ anio: 2026, t: 1 }, -1)).toEqual({ anio: 2025, t: 4 });
    expect(moverTrimestre({ anio: 2026, t: 4 }, 1)).toEqual({ anio: 2027, t: 1 });
  });
});

describe('validarFactura', () => {
  const ok: DatosFactura = {
    numero: '2026-001',
    fecha: '2026-11-02',
    vencimiento: '2026-12-02',
    clienteNombre: 'Estudio Norte SL',
    lineas: [{ concepto: 'Diseño', base: 100000, tipoIVA: 21 }],
    retencion: 15,
    nota: '',
  };
  it('acepta una factura completa', () => expect(validarFactura(ok)).toBeNull());
  it('rechaza lo que no cuadra', () => {
    expect(validarFactura({ ...ok, numero: ' ' })).toMatch(/número/);
    expect(validarFactura({ ...ok, vencimiento: '2026-11-01' })).toMatch(/vencimiento/);
    expect(validarFactura({ ...ok, clienteNombre: '' })).toMatch(/a quién/);
    expect(validarFactura({ ...ok, lineas: [] })).toMatch(/concepto/);
    expect(validarFactura({ ...ok, lineas: [{ concepto: 'x', base: 0, tipoIVA: 21 }] })).toMatch(/base/);
    expect(validarFactura({ ...ok, lineas: [{ concepto: 'x', base: 100, tipoIVA: 16 }] })).toMatch(/IVA/);
    expect(validarFactura({ ...ok, retencion: 19 })).toMatch(/retención/);
  });
});
