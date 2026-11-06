import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NetoDB } from './db';
import { completarInicio, crearCuenta, guardarPerfilNegocio, obtenerAjustes } from './repo';
import {
  actualizarCliente,
  anularCobro,
  borrarCliente,
  borrarFactura,
  cobrarFactura,
  crearFactura,
  actualizarFactura,
} from './facturas';
import { crearCopia, restaurarCopia, validarCopia } from '../lib/backup';
import { saldosPorCuenta } from '../lib/balances';
import type { DatosFactura } from '../lib/facturas';

let d: NetoDB,
  n = 0,
  cuenta: string;

const factura = (cambios: Partial<DatosFactura> = {}): DatosFactura => ({
  numero: '2026-001',
  fecha: '2026-10-05',
  vencimiento: '2026-11-04',
  clienteNombre: 'Estudio Norte SL',
  clienteNif: 'b12345678',
  lineas: [{ concepto: 'Diseño de marca', base: 100000, tipoIVA: 21 }],
  retencion: 15,
  nota: '',
  ...cambios,
});

beforeEach(async () => {
  d = new NetoDB('facturas-' + ++n);
  await d.open();
  await completarInicio({ nombre: 'Alex', autonomo: true }, d);
  cuenta = await crearCuenta({ nombre: 'Cuenta negocio', tipo: 'banco', ambito: 'negocio', saldoInicial: 0 }, d);
});
afterEach(async () => {
  d.close();
  await d.delete();
});

describe('facturas emitidas', () => {
  it('guarda la factura y crea el cliente una sola vez, con el NIF en mayúsculas', async () => {
    await crearFactura(factura(), d);
    await crearFactura(factura({ numero: '2026-002', clienteNombre: '  estudio norte sl ' }), d);
    const clientes = await d.clientes.toArray();
    expect(clientes).toHaveLength(1);
    expect(clientes[0]).toMatchObject({ nombre: 'Estudio Norte SL', nif: 'B12345678' });
    const facturas = await d.facturas.toArray();
    expect(facturas.every((f) => f.clienteId === clientes[0].id && f.cobradaEn === null)).toBe(true);
  });

  it('no deja repetir un número de factura', async () => {
    await crearFactura(factura(), d);
    await expect(crearFactura(factura({ numero: ' 2026-001 ' }), d)).rejects.toThrow(/2026-001/);
  });

  it('al cobrarla en una cuenta apunta lo que paga el cliente: base + IVA − retención', async () => {
    const id = await crearFactura(factura(), d);
    await cobrarFactura(id, { fecha: '2026-10-20', cuentaId: cuenta }, d);
    const f = (await d.facturas.get(id))!;
    expect(f.cobradaEn).toBe('2026-10-20');
    const m = (await d.movimientos.get(f.movimientoId!))!;
    // 1.000,00 + 210,00 − 150,00 = 1.060,00
    expect(m).toMatchObject({ tipo: 'ingreso', importe: 106000, cuentaId: cuenta, facturaId: id, origen: 'factura' });
    expect(m.nota).toBe('Factura 2026-001 · Estudio Norte SL');
    const cat = (await d.categorias.get(m.categoriaId!))!;
    expect(cat).toMatchObject({ nombre: 'Facturación', tipo: 'ingreso' });
    const saldos = saldosPorCuenta(await d.cuentas.toArray(), await d.movimientos.toArray());
    expect(saldos.get(cuenta)).toBe(106000);
  });

  it('cobrar sin cuenta solo cambia el estado; dos cobros usan la misma categoría', async () => {
    const a = await crearFactura(factura(), d);
    const b = await crearFactura(factura({ numero: '2026-002' }), d);
    await cobrarFactura(a, { fecha: '2026-10-20', cuentaId: null }, d);
    expect(await d.movimientos.count()).toBe(0);
    await cobrarFactura(b, { fecha: '2026-10-21', cuentaId: cuenta }, d);
    const c = await cobrarFactura(a, { fecha: '2026-10-21', cuentaId: cuenta }, d).catch((e) => e);
    expect(String(c)).toMatch(/ya está cobrada/);
    expect((await d.categorias.toArray()).filter((x) => x.nombre === 'Facturación')).toHaveLength(1);
  });

  it('no acepta cobros futuros ni anteriores a la factura', async () => {
    const id = await crearFactura(factura(), d);
    await expect(cobrarFactura(id, { fecha: '2999-01-01', cuentaId: cuenta }, d)).rejects.toThrow(/hasta hoy/);
    await expect(cobrarFactura(id, { fecha: '2026-10-01', cuentaId: cuenta }, d)).rejects.toThrow(/anterior/);
  });

  it('anular el cobro la deja pendiente y quita el ingreso', async () => {
    const id = await crearFactura(factura(), d);
    await cobrarFactura(id, { fecha: '2026-10-20', cuentaId: cuenta }, d);
    await anularCobro(id, d);
    expect(await d.facturas.get(id)).toMatchObject({ cobradaEn: null, movimientoId: null });
    expect(await d.movimientos.count()).toBe(0);
  });

  it('editar una factura cobrada ajusta el ingreso apuntado', async () => {
    const id = await crearFactura(factura(), d);
    await cobrarFactura(id, { fecha: '2026-10-20', cuentaId: cuenta }, d);
    // 1.200,00 + 252,00 − 180,00 = 1.272,00
    await actualizarFactura(id, factura({ lineas: [{ concepto: 'Diseño', base: 120000, tipoIVA: 21 }] }), d);
    const f = (await d.facturas.get(id))!;
    expect((await d.movimientos.get(f.movimientoId!))!.importe).toBe(127200);
  });

  it('borrar la factura borra también su cobro', async () => {
    const id = await crearFactura(factura(), d);
    await cobrarFactura(id, { fecha: '2026-10-20', cuentaId: cuenta }, d);
    await borrarFactura(id, d);
    expect(await d.facturas.count()).toBe(0);
    expect(await d.movimientos.count()).toBe(0);
  });
});

describe('clientes', () => {
  it('no se borra un cliente con facturas; sí uno sin ellas', async () => {
    await crearFactura(factura(), d);
    const c = (await d.clientes.toArray())[0];
    await expect(borrarCliente(c.id, d)).rejects.toThrow(/una factura/);
    await borrarFactura((await d.facturas.toArray())[0].id, d);
    await borrarCliente(c.id, d);
    expect(await d.clientes.count()).toBe(0);
  });

  it('no deja dos clientes con el mismo nombre', async () => {
    await crearFactura(factura(), d);
    await crearFactura(factura({ numero: '2026-002', clienteNombre: 'Otra SL', clienteNif: '' }), d);
    const otra = (await d.clientes.toArray()).find((c) => c.nombre === 'Otra SL')!;
    await expect(actualizarCliente(otra.id, { nombre: 'ESTUDIO NORTE SL', nif: '' }, d)).rejects.toThrow(/Ya tienes/);
  });
});

describe('copia de seguridad', () => {
  it('guarda y restaura facturas, clientes y cobros', async () => {
    const id = await crearFactura(factura(), d);
    await cobrarFactura(id, { fecha: '2026-10-20', cuentaId: cuenta }, d);
    const copia = await crearCopia(d);
    const r = validarCopia(JSON.parse(JSON.stringify(copia)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await restaurarCopia(r.copia, d);
    expect(await d.facturas.count()).toBe(1);
    expect(await d.clientes.count()).toBe(1);
  });

  it('rechaza una copia con el cobro de una factura perdido', async () => {
    const id = await crearFactura(factura(), d);
    await cobrarFactura(id, { fecha: '2026-10-20', cuentaId: cuenta }, d);
    const copia = JSON.parse(JSON.stringify(await crearCopia(d)));
    copia.datos.movimientos = [];
    const r = validarCopia(copia);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cobro de la factura 2026-001/);
  });
});

describe('perfil del negocio', () => {
  it('dos cambios seguidos no se pisan', async () => {
    await Promise.all([
      guardarPerfilNegocio({ nuevoAutonomo: true }, d),
      guardarPerfilNegocio({ fechaAlta: '2025-03-01' }, d),
    ]);
    expect((await obtenerAjustes(d)).negocio).toMatchObject({
      nuevoAutonomo: true,
      fechaAlta: '2025-03-01',
      actividad: 'profesional',
    });
  });
  it('rechaza una reserva fuera de rango', async () => {
    await expect(guardarPerfilNegocio({ reservaIRPF: 80 }, d)).rejects.toThrow(/entre 0 % y 60 %/);
  });
});
