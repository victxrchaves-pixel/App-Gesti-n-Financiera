import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NetoDB } from './db';
import { borrarMovimiento, completarInicio, crearCuenta, guardarPerfilNegocio, obtenerAjustes } from './repo';
import { actualizarGastoNegocio, borrarGastoNegocio, crearGastoNegocio } from './gastosNegocio';
import { cobrarFactura, crearFactura } from './facturas';
import { crearCopia, validarCopia } from '../lib/backup';
import { saldosPorCuenta } from '../lib/balances';
import type { DatosGastoNegocio } from '../lib/gastosNegocio';

let d: NetoDB,
  n = 0,
  cuenta: string;

const gasto = (cambios: Partial<DatosGastoNegocio> = {}): DatosGastoNegocio => ({
  fecha: '2026-10-12',
  proveedor: 'Adobe',
  numero: 'IE2026-118',
  concepto: 'Creative Cloud',
  categoria: 'software',
  base: 4000,
  tipoIVA: 21,
  cuotaIVA: 840,
  deducibleIVA: 100,
  deducibleIRPF: 100,
  cuentaId: cuenta,
  nota: '',
  ...cambios,
});

beforeEach(async () => {
  d = new NetoDB('gastos-negocio-' + ++n);
  await d.open();
  await completarInicio({ nombre: 'Alex', autonomo: true }, d);
  cuenta = await crearCuenta({ nombre: 'Cuenta negocio', tipo: 'banco', ambito: 'negocio', saldoInicial: 100000 }, d);
});
afterEach(async () => {
  d.close();
  await d.delete();
});

describe('gastos del negocio', () => {
  it('apunta el pago (base + IVA) en la cuenta, en la categoría Gastos del negocio', async () => {
    const id = await crearGastoNegocio(gasto(), d);
    const g = (await d.gastosNegocio.get(id))!;
    const m = (await d.movimientos.get(g.movimientoId!))!;
    expect(m).toMatchObject({
      tipo: 'gasto',
      importe: 4840,
      cuentaId: cuenta,
      origen: 'gasto-negocio',
      gastoNegocioId: id,
    });
    expect(m.nota).toBe('Adobe · Creative Cloud');
    expect((await d.categorias.get(m.categoriaId!))!.nombre).toBe('Gastos del negocio');
    // 1.000,00 − 48,40 = 951,60
    expect(saldosPorCuenta(await d.cuentas.toArray(), await d.movimientos.toArray()).get(cuenta)).toBe(95160);
  });

  it('sin cuenta solo se registra el gasto', async () => {
    const id = await crearGastoNegocio(gasto({ cuentaId: null }), d);
    expect((await d.gastosNegocio.get(id))!.movimientoId).toBeNull();
    expect(await d.movimientos.count()).toBe(0);
  });

  it('editar ajusta el pago, y quitar la cuenta lo borra', async () => {
    const id = await crearGastoNegocio(gasto(), d);
    await actualizarGastoNegocio(id, gasto({ base: 5000, cuotaIVA: 1050 }), d);
    const g = (await d.gastosNegocio.get(id))!;
    expect((await d.movimientos.get(g.movimientoId!))!.importe).toBe(6050);
    await actualizarGastoNegocio(id, gasto({ cuentaId: null }), d);
    expect((await d.gastosNegocio.get(id))!.movimientoId).toBeNull();
    expect(await d.movimientos.count()).toBe(0);
  });

  it('borrar el gasto borra su pago', async () => {
    const id = await crearGastoNegocio(gasto(), d);
    await borrarGastoNegocio(id, d);
    expect(await d.gastosNegocio.count()).toBe(0);
    expect(await d.movimientos.count()).toBe(0);
  });

  it('no apunta en la cuenta un pago con fecha futura', async () => {
    await expect(crearGastoNegocio(gasto({ fecha: '2999-01-01' }), d)).rejects.toThrow(/hoy o antes/);
  });

  it('borrar el pago desde Movimientos deja el gasto registrado y sin vínculo roto', async () => {
    const id = await crearGastoNegocio(gasto(), d);
    await borrarMovimiento((await d.gastosNegocio.get(id))!.movimientoId!, d);
    expect(await d.gastosNegocio.get(id)).toMatchObject({ movimientoId: null, cuentaId: null });
    expect(validarCopia(JSON.parse(JSON.stringify(await crearCopia(d)))).ok).toBe(true);
  });

  it('lo mismo con el cobro de una factura', async () => {
    const f = await crearFactura(
      {
        numero: '2026-001',
        fecha: '2026-10-01',
        vencimiento: '2026-10-31',
        clienteNombre: 'Estudio Norte SL',
        lineas: [{ concepto: 'Diseño', base: 100000, tipoIVA: 21 }],
        retencion: 15,
        nota: '',
      },
      d,
    );
    await cobrarFactura(f, { fecha: '2026-10-20', cuentaId: cuenta }, d);
    await borrarMovimiento((await d.facturas.get(f))!.movimientoId!, d);
    expect(await d.facturas.get(f)).toMatchObject({ cobradaEn: '2026-10-20', movimientoId: null });
    expect(validarCopia(JSON.parse(JSON.stringify(await crearCopia(d)))).ok).toBe(true);
  });

  it('la copia rechaza un gasto con el pago perdido', async () => {
    await crearGastoNegocio(gasto(), d);
    const copia = JSON.parse(JSON.stringify(await crearCopia(d)));
    copia.datos.movimientos = [];
    const r = validarCopia(copia);
    expect(r.ok).toBe(false);
  });
});

describe('metros de la vivienda', () => {
  it('se guardan y la zona de trabajo no puede superar la vivienda', async () => {
    await guardarPerfilNegocio({ metrosVivienda: 80, metrosTrabajo: 12 }, d);
    expect((await obtenerAjustes(d)).negocio).toMatchObject({ metrosVivienda: 80, metrosTrabajo: 12 });
    await expect(guardarPerfilNegocio({ metrosTrabajo: 100 }, d)).rejects.toThrow(/más grande/);
  });
});
