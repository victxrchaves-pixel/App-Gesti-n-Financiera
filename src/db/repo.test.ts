import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearCopia, restaurarCopia, validarCopia } from '../lib/backup';
import { NetoDB } from './db';
import {
  borrarCategoria, borrarCuenta, completarInicio, crearCuenta, crearMovimiento, obtenerAjustes,
} from './repo';

let d: NetoDB;
let n = 0;
beforeEach(async () => {
  d = new NetoDB(`test-${++n}`);
  await d.open();
});
afterEach(async () => {
  await d.delete();
});

describe('inicio de la app', () => {
  it('guarda el nombre, el modo autónomo y crea las categorías', async () => {
    await completarInicio({ nombre: 'Victor', autonomo: true }, d);
    const a = await obtenerAjustes(d);
    expect(a).toMatchObject({ nombre: 'Victor', autonomo: true, inicioCompletado: true });
    const cats = await d.categorias.toArray();
    expect(cats.filter((c) => c.tipo === 'gasto').sort((a, b) => a.orden - b.orden).map((c) => c.nombre)).toEqual([
      'Casa', 'Comida', 'Transporte', 'Ocio', 'Salud', 'Ropa', 'Suscripciones', 'Otros',
    ]);
  });
});

describe('movimientos', () => {
  it('valida importe, cuenta, categoría y transferencias', async () => {
    const base = { tipo: 'gasto' as const, fecha: '2026-11-04', importe: 1000, cuentaId: 'a', categoriaId: 'c', nota: '' };
    await expect(crearMovimiento({ ...base, importe: 0 }, d)).rejects.toThrow('mayor que 0');
    await expect(crearMovimiento({ ...base, categoriaId: undefined }, d)).rejects.toThrow('categoría');
    await expect(crearMovimiento({ ...base, tipo: 'transferencia', cuentaDestinoId: 'a' }, d)).rejects.toThrow('distintas');
  });

  it('una transferencia no guarda categoría', async () => {
    const id = await crearMovimiento({ tipo: 'transferencia', fecha: '2026-11-04', importe: 1000, cuentaId: 'a', cuentaDestinoId: 'b', categoriaId: 'x', nota: ' hola ' }, d);
    const m = await d.movimientos.get(id);
    expect(m?.categoriaId).toBeUndefined();
    expect(m?.nota).toBe('hola');
  });
});

describe('cuentas y categorías', () => {
  it('no deja borrar una cuenta con movimientos', async () => {
    const id = await crearCuenta({ nombre: 'Banco', tipo: 'banco', ambito: 'personal', saldoInicial: 0 }, d);
    await crearMovimiento({ tipo: 'ingreso', fecha: '2026-11-04', importe: 100, cuentaId: id, categoriaId: 'c', nota: '' }, d);
    await expect(borrarCuenta(id, d)).rejects.toThrow('Archívala');
  });

  it('al borrar una categoría sus movimientos pasan a "Otros"', async () => {
    await completarInicio({ nombre: 'V', autonomo: false }, d);
    const cats = await d.categorias.toArray();
    const ocio = cats.find((c) => c.nombre === 'Ocio')!;
    const otros = cats.find((c) => c.nombre === 'Otros')!;
    const id = await crearMovimiento({ tipo: 'gasto', fecha: '2026-11-04', importe: 100, cuentaId: 'a', categoriaId: ocio.id, nota: '' }, d);
    await borrarCategoria(ocio.id, undefined, d);
    expect((await d.movimientos.get(id))?.categoriaId).toBe(otros.id);
    expect(await d.categorias.get(ocio.id)).toBeUndefined();
  });
});

describe('copia de seguridad', () => {
  it('exportar y restaurar devuelve exactamente los mismos datos', async () => {
    await completarInicio({ nombre: 'Victor', autonomo: false }, d);
    const banco = await crearCuenta({ nombre: 'Banco', tipo: 'banco', ambito: 'personal', saldoInicial: 123456 }, d);
    await crearMovimiento({ tipo: 'gasto', fecha: '2026-11-04', importe: 4599, cuentaId: banco, categoriaId: 'c', nota: 'Súper' }, d);
    const copia = await crearCopia(d);

    // Simulamos guardar el archivo y abrirlo de nuevo.
    const leida = validarCopia(JSON.parse(JSON.stringify(copia)));
    expect(leida.ok).toBe(true);

    await d.movimientos.clear();
    await crearCuenta({ nombre: 'Basura', tipo: 'otra', ambito: 'personal', saldoInicial: 1 }, d);
    if (leida.ok) await restaurarCopia(leida.copia, d);

    const despues = await crearCopia(d, new Date(copia.exportadaEn));
    expect(despues).toEqual(copia);
  });

  it('rechaza archivos que no son de Neto o están dañados', () => {
    expect(validarCopia({ foo: 1 }).ok).toBe(false);
    expect(validarCopia({ app: 'neto', version: 999, datos: {} })).toMatchObject({ ok: false, error: expect.stringContaining('más nueva') });
    const mala = { app: 'neto', version: 1, datos: { movimientos: [{ id: 'x', importe: 12.5, fecha: '2026-11-04' }] } };
    expect(validarCopia(mala).ok).toBe(false);
  });
});
