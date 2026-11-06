import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { NetoDB } from './db';
import {
  completarInicio,
  crearCuenta,
  crearMovimiento,
  actualizarMovimiento,
  borrarMovimiento,
  borrarCategoria,
  borrarCuenta,
} from './repo';
import { guardarPagoFijo, registrarAutomaticos, registrarPago } from './recurring';
import { guardarSuscripcion } from './finance';
import { crearCopia, validarCopia, restaurarCopia } from '../lib/backup';
import { dineroDisponible, patrimonio } from '../lib/balances';
import { gastosPresupuesto } from '../lib/budgets';
import { todayISO, addDays, addMonths, monthKey } from '../lib/dates';
import type { PagoFijo } from './types';
let d: NetoDB,
  n = 0,
  cuenta: string,
  gasto: string,
  ingreso: string;
let fijo: Omit<PagoFijo, 'id'>;
beforeEach(async () => {
  d = new NetoDB('recurring-' + ++n);
  await d.open();
  await completarInicio({ nombre: 'Alex', autonomo: false }, d);
  cuenta = await crearCuenta({ nombre: 'Banco', tipo: 'banco', ambito: 'personal', saldoInicial: 100000 }, d);
  gasto = (await d.categorias.where('tipo').equals('gasto').first())!.id;
  ingreso = (await d.categorias.where('tipo').equals('ingreso').first())!.id;
  fijo = {
    nombre: 'Alquiler',
    tipo: 'gasto',
    importe: 10000,
    periodo: 'mensual',
    proximaFecha: '2026-01-31',
    diaCobro: 31,
    cuentaId: cuenta,
    categoriaId: gasto,
    activo: true,
    nota: '',
  };
});
afterEach(async () => {
  await d.delete();
});
const datos = (id: string) => ({
  origen: 'fijo' as const,
  recurrenteId: id,
  periodoFecha: '2026-01-31',
  fecha: todayISO(),
  importe: 10000,
  cuentaId: cuenta,
  categoriaId: gasto,
});
async function nuevo() {
  await guardarPagoFijo(fijo, undefined, d);
  return (await d.pagosFijos.toArray())[0].id;
}
it('crear fichas con referencias futuras no registra dinero ni reduce el disponible', async () => {
  await guardarPagoFijo({ ...fijo, proximaFecha: addDays(todayISO(), 30) }, undefined, d);
  await guardarPagoFijo({ ...fijo, nombre: 'Nómina', tipo: 'ingreso', categoriaId: ingreso }, undefined, d);
  expect(await d.movimientos.count()).toBe(0);
  expect(dineroDisponible(await d.cuentas.toArray(), []).disponible).toBe(100000);
});
it('Pagado registra un gasto real y avanza el periodo de forma atómica; repetir la misma confirmación no duplica', async () => {
  const id = await nuevo();
  const ids = await Promise.all([registrarPago(datos(id), d), registrarPago(datos(id), d)]);
  expect(ids[0]).toBe(ids[1]);
  expect(await d.movimientos.count()).toBe(1);
  expect(await d.pagosRegistrados.orderBy('fecha').reverse().toArray()).toHaveLength(1);
  expect((await d.pagosFijos.get(id))?.proximaFecha).toBe('2026-02-28');
  expect(await d.movimientos.get(ids[0])).toMatchObject({
    tipo: 'gasto',
    importe: 10000,
    fecha: todayISO(),
    origen: 'recurrente',
  });
  expect(patrimonio(await d.cuentas.toArray(), await d.movimientos.toArray(), 'personal')).toBe(90000);
  await registrarPago({ ...datos(id), periodoFecha: '2026-02-28' }, d);
  expect((await d.pagosFijos.get(id))?.proximaFecha).toBe('2026-03-31');
  expect(await d.movimientos.count()).toBe(2);
});
it('Cobrado usa el importe realmente ingresado, sin multiplicar referencias de meses pendientes', async () => {
  const id = await nuevo();
  await guardarPagoFijo({ ...fijo, tipo: 'ingreso', categoriaId: ingreso, nombre: 'Nómina' }, id, d);
  await registrarPago({ ...datos(id), categoriaId: ingreso, importe: 25000 }, d);
  expect((await d.movimientos.toArray())[0]).toMatchObject({ tipo: 'ingreso', importe: 25000 });
  expect(patrimonio(await d.cuentas.toArray(), await d.movimientos.toArray(), 'personal')).toBe(125000);
  expect(await d.movimientos.count()).toBe(1);
});
it('confirmar una suscripción integra el gasto en movimientos, saldo y presupuesto', async () => {
  const sub = await guardarSuscripcion(
    {
      nombre: 'Netflix',
      servicioId: 'netflix',
      categoria: 'Entretenimiento',
      ambito: 'personal',
      importe: 1500,
      periodo: 'mensual',
      proximaFecha: todayISO(),
      diaCobro: Number(todayISO().slice(-2)),
      estado: 'activa',
      nota: '',
    },
    undefined,
    d,
  );
  expect(await d.movimientos.count()).toBe(0);
  await registrarPago({ ...datos(sub), origen: 'suscripcion', periodoFecha: todayISO(), importe: 1500 }, d);
  const movs = await d.movimientos.toArray();
  expect(movs[0]).toMatchObject({ tipo: 'gasto', importe: 1500 });
  expect(patrimonio(await d.cuentas.toArray(), movs, 'personal')).toBe(98500);
  expect(gastosPresupuesto(movs, await d.cuentas.toArray(), todayISO().slice(0, 7), todayISO())).toHaveLength(1);
});
it('una fecha futura, cuenta eliminada, categoría incorrecta o ficha pausada no deja movimientos ni avanza el periodo', async () => {
  const id = await nuevo();
  await expect(registrarPago({ ...datos(id), fecha: addDays(todayISO(), 1) }, d)).rejects.toThrow('hasta hoy');
  await expect(registrarPago({ ...datos(id), categoriaId: ingreso }, d)).rejects.toThrow('categoría');
  await d.pagosFijos.update(id, { activo: false });
  await expect(registrarPago(datos(id), d)).rejects.toThrow('activo');
  await d.pagosFijos.update(id, { activo: true });
  await borrarCuenta(cuenta, d);
  await expect(registrarPago(datos(id), d)).rejects.toThrow('cuenta');
  expect(await d.movimientos.count()).toBe(0);
  expect(await d.pagosRegistrados.count()).toBe(0);
  expect((await d.pagosFijos.get(id))?.proximaFecha).toBe('2026-01-31');
});
it('eliminar una categoría actualiza también las fichas fijas al destino', async () => {
  const id = await nuevo();
  const otra = (await d.categorias.where('tipo').equals('gasto').toArray()).find((c) => c.id !== gasto)!.id;
  await borrarCategoria(gasto, otra, d);
  expect((await d.pagosFijos.get(id))?.categoriaId).toBe(otra);
  await registrarPago({ ...datos(id), categoriaId: otra }, d);
  expect(await d.movimientos.count()).toBe(1);
});
it('las copias incluyen fichas y pagos; borrar la ficha no elimina los movimientos; editar o borrar estos no inventa otro pago', async () => {
  const id = await nuevo();
  const mov = await registrarPago(datos(id), d);
  await actualizarMovimiento(
    mov,
    {
      tipo: 'gasto',
      importe: 8000,
      fecha: todayISO(),
      cuentaId: cuenta,
      categoriaId: gasto,
      nota: 'Importe corregido',
    },
    d,
  );
  const copia = await crearCopia(d);
  expect(validarCopia(copia).ok).toBe(true);
  await restaurarCopia(copia, d);
  expect(await crearCopia(d, new Date(copia.exportadaEn))).toEqual(copia);
  await d.pagosFijos.delete(id);
  expect(await d.movimientos.count()).toBe(1);
  await borrarMovimiento(mov, d);
  expect(await d.movimientos.count()).toBe(0);
  expect(validarCopia(await crearCopia(d)).ok).toBe(true);
});
it('rechaza movimientos futuros incluso desde el formulario general', async () => {
  await expect(
    crearMovimiento(
      { tipo: 'gasto', importe: 100, fecha: addDays(todayISO(), 1), cuentaId: cuenta, categoriaId: gasto, nota: '' },
      d,
    ),
  ).rejects.toThrow('hasta hoy');
  expect(await d.movimientos.count()).toBe(0);
});
it('mantiene las suscripciones y reservas v6 al migrar, excluye cuentas archivadas y habilita varias aportaciones al mismo mes', async () => {
  const { default: Dexie } = await import('dexie');
  const vieja = new Dexie('recurring-legacy-v6');
  vieja.version(6).stores({
    cuentas: 'id, ambito, orden',
    movimientos: 'id, fecha, cuentaId, cuentaDestinoId, categoriaId, tipo',
    categorias: 'id, tipo, orden',
    ajustes: 'id',
    suscripciones: 'id, ambito, estado, categoria, proximaFecha',
    inversiones: 'id, tipo, activoId',
    historialCartera: 'id, fecha',
    presupuestos: 'id, mes, categoriaId, &[mes+categoriaId]',
    metas: 'id, mesInicio',
    aportesMetas: 'id, metaId, mes, &[metaId+mes]',
  });
  await vieja
    .table('cuentas')
    .put({ id: 'old', ambito: 'personal', tipo: 'banco', saldoInicial: 25000, archivada: true });
  await vieja.table('suscripciones').put({ id: 'old-sub', nombre: 'Netflix', proximaFecha: todayISO() });
  await vieja.table('metas').put({ id: 'meta', cuentaOrigenId: 'old', activa: true });
  await vieja
    .table('aportesMetas')
    .put({ id: 'a', metaId: 'meta', mes: '2026-01', importe: 10000, origen: 'confirmado' });
  vieja.close();
  const nueva = new NetoDB('recurring-legacy-v6');
  try {
    await nueva.open();
    expect(await nueva.cuentas.get('old')).toMatchObject({ eliminada: true, archivada: false });
    expect(patrimonio(await nueva.cuentas.toArray(), [])).toBe(0);
    expect((await nueva.metas.get('meta'))?.activa).toBe(false);
    expect((await nueva.suscripciones.get('old-sub'))?.nombre).toBe('Netflix');
    await nueva.aportesMetas.add({ id: 'b', metaId: 'meta', mes: '2026-01', importe: 10000, origen: 'confirmado' });
    expect(await nueva.aportesMetas.count()).toBe(2);
    expect(await nueva.pagosRegistrados.orderBy('fecha').toArray()).toEqual([]);
  } finally {
    await nueva.delete();
  }
});

describe('apuntar automáticamente', () => {
  // Gimnasio de 42,00 € el día 5 de cada mes, automático, con la primera cuota hace dos meses:
  // al abrir Neto se apuntan las dos cuotas vencidas y la ficha pasa al mes siguiente.
  it('apunta solos los periodos vencidos, con su fecha, y no los repite', async () => {
    const hoy = todayISO();
    const inicio = addMonths(monthKey(hoy), -2) + '-05';
    await guardarPagoFijo(
      { ...fijo, nombre: 'Gimnasio', importe: 4200, proximaFecha: inicio, diaCobro: 5, automatico: true },
      undefined,
      d,
    );
    const id = (await d.pagosFijos.toArray()).find((f) => f.nombre === 'Gimnasio')!.id;
    const esperadas = [inicio, addMonths(monthKey(hoy), -1) + '-05', monthKey(hoy) + '-05'].filter((f) => f <= hoy);
    expect(await registrarAutomaticos(hoy, d)).toBe(esperadas.length);
    expect(await registrarAutomaticos(hoy, d)).toBe(0);
    const movs = (await d.movimientos.toArray()).filter((m) => m.nota === 'Gimnasio');
    expect(movs.map((m) => m.fecha).sort()).toEqual(esperadas);
    expect(movs.every((m) => m.importe === 4200 && m.origen === 'recurrente')).toBe(true);
    expect((await d.pagosFijos.get(id))!.proximaFecha > hoy).toBe(true);
  });

  it('las fichas sin la opción siguen esperando a que confirmes', async () => {
    await guardarPagoFijo({ ...fijo, nombre: 'Luz', proximaFecha: addDays(todayISO(), -3) }, undefined, d);
    expect(await registrarAutomaticos(todayISO(), d)).toBe(0);
    expect((await d.movimientos.toArray()).some((m) => m.nota === 'Luz')).toBe(false);
  });

  it('una suscripción automática se cobra de su cuenta con la categoría Suscripciones', async () => {
    await guardarSuscripcion(
      {
        nombre: 'Netflix',
        categoria: 'Entretenimiento',
        ambito: 'personal',
        importe: 1399,
        periodo: 'mensual',
        proximaFecha: todayISO(),
        diaCobro: Number(todayISO().slice(-2)),
        estado: 'activa',
        nota: '',
        automatico: true,
        cuentaId: cuenta,
      },
      undefined,
      d,
    );
    expect(await registrarAutomaticos(todayISO(), d)).toBe(1);
    const m = (await d.movimientos.toArray()).find((x) => x.nota === 'Netflix')!;
    const cat = await d.categorias.get(m.categoriaId!);
    expect([m.cuentaId, m.importe, cat?.nombre]).toEqual([cuenta, 1399, 'Suscripciones']);
  });
});
