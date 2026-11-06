import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NetoDB } from './db';
import {
  completarInicio,
  crearCuenta,
  crearMovimiento,
  actualizarMovimiento,
  borrarMovimiento,
  borrarCategoria,
} from './repo';
import { asegurarPlanMes, guardarPresupuesto, borrarPresupuesto } from './budgets';
import { registrarDevolucion } from './movementActions';
import { guardarPagoFijo, registrarPago, omitirPeriodo, deshacerPago } from './recurring';
import { asignarAhorroGeneral } from './savings';
import { importarCSV } from './csv';
import { leerCSV, prepararCSV } from '../lib/csv';
import { fichasRecurrentes, recurrentesPendientes } from '../lib/recurring';
import { resumenPresupuestos, gastosPresupuesto } from '../lib/budgets';
import { patrimonio, dineroDisponible } from '../lib/balances';
import { resumenMes, gastoPorCategoria } from '../lib/stats';
import { todayISO, monthKey, addDays } from '../lib/dates';
import { crearCopia, validarCopia, restaurarCopia } from '../lib/backup';
import { dineroMeta } from '../lib/goalMoney';
let d: NetoDB,
  banco: string,
  comida: string,
  ocio: string,
  ingreso: string,
  n = 0;
const hoy = todayISO(),
  mes = monthKey(hoy);
beforeEach(async () => {
  d = new NetoDB(`everyday-${++n}`);
  await d.open();
  await completarInicio({ nombre: 'Alex', autonomo: false }, d);
  banco = await crearCuenta({ nombre: 'Banco', tipo: 'banco', ambito: 'personal', saldoInicial: 100000 }, d);
  const cats = await d.categorias.toArray();
  comida = cats.find((c) => c.nombre === 'Comida')!.id;
  ocio = cats.find((c) => c.nombre === 'Ocio')!.id;
  ingreso = cats.find((c) => c.tipo === 'ingreso')!.id;
});
afterEach(async () => {
  await d.delete();
});
const movimiento = (importe = 8000) => ({
  tipo: 'gasto' as const,
  importe,
  fecha: hoy,
  cuentaId: banco,
  categoriaId: comida,
  nota: 'Compra',
  reparto: [
    { categoriaId: comida, importe: (importe * 3) / 4 },
    { categoriaId: ocio, importe: importe / 4 },
  ],
});
const estado = async () => ({ cuentas: await d.cuentas.toArray(), movs: await d.movimientos.toArray() });

it('repite límites y colores entre años una sola vez sin copiar gastos ni sobrescribir límites ajustados', async () => {
  await guardarPresupuesto({ mes: '2025-12', categoriaId: comida, limite: 30000, color: '#123456' }, undefined, d);
  await guardarPresupuesto({ mes: '2026-01', categoriaId: ocio, limite: 5000 }, undefined, d);
  await crearMovimiento(movimiento(), d);
  await Promise.all([asegurarPlanMes('2026-01', d), asegurarPlanMes('2026-01', d)]);
  const ps = await d.presupuestos.where('mes').equals('2026-01').toArray();
  expect(ps).toHaveLength(2);
  expect(ps.find((p) => p.categoriaId === comida)).toMatchObject({ limite: 30000, color: '#123456' });
  expect((await d.planesMes.get('2026-01'))?.revisado).toBe(false);
  expect(await d.movimientos.count()).toBe(1);
  await d.planesMes.update('2026-01', { revisado: true });
  await asegurarPlanMes('2026-01', d);
  expect((await d.planesMes.get('2026-01'))?.revisado).toBe(true);
});
it('un presupuesto vacío por decisión del usuario no reaparece al volver ni en meses posteriores', async () => {
  await guardarPresupuesto({ mes: '2026-01', categoriaId: comida, limite: 10000 }, undefined, d);
  await asegurarPlanMes('2026-02', d);
  for (const p of await d.presupuestos.where('mes').equals('2026-02').toArray()) await borrarPresupuesto(p.id, d);
  await asegurarPlanMes('2026-02', d);
  await asegurarPlanMes('2026-05', d);
  expect(await d.presupuestos.where('mes').equals('2026-05').count()).toBe(0);
});
it('dividir un pago afecta a dos presupuestos y al saldo exactamente una vez', async () => {
  await crearMovimiento(movimiento(), d);
  const { cuentas, movs } = await estado();
  expect(patrimonio(cuentas, movs)).toBe(92000);
  expect(resumenMes(movs, cuentas, mes)).toMatchObject({ gastos: 8000, ingresos: 0 });
  expect(gastoPorCategoria(movs, cuentas, mes)).toEqual([
    { categoriaId: comida, importe: 6000 },
    { categoriaId: ocio, importe: 2000 },
  ]);
  expect(await d.movimientos.count()).toBe(1);
  await expect(
    crearMovimiento(
      {
        ...movimiento(),
        reparto: [
          { categoriaId: comida, importe: 5000 },
          { categoriaId: ocio, importe: 2000 },
        ],
      },
      d,
    ),
  ).rejects.toThrow('exactamente');
  await expect(
    crearMovimiento(
      {
        ...movimiento(),
        reparto: [
          { categoriaId: ingreso, importe: 6000 },
          { categoriaId: ocio, importe: 2000 },
        ],
      },
      d,
    ),
  ).rejects.toThrow('tipo incorrecto');
});
it('una devolución parcial reduce los gastos originales y el presupuesto sin sumarse a ingresos', async () => {
  const id = await crearMovimiento(movimiento(), d);
  const datos = { gastoId: id, importe: 4000, fecha: hoy, cuentaId: banco, operacionId: 'refund-1' };
  const ids = await Promise.all([registrarDevolucion(datos, d), registrarDevolucion(datos, d)]);
  expect(ids[0]).toBe(ids[1]);
  const { cuentas, movs } = await estado();
  expect(patrimonio(cuentas, movs)).toBe(96000);
  expect(resumenMes(movs, cuentas, mes)).toMatchObject({ gastos: 4000, ingresos: 0 });
  const ps = [
    { id: 'p', mes, categoriaId: comida, limite: 10000 },
    { id: 'p2', mes, categoriaId: ocio, limite: 5000 },
  ];
  expect(resumenPresupuestos(ps, gastosPresupuesto(movs, cuentas, mes, hoy))).toMatchObject({
    gastado: 4000,
    restante: 11000,
  });
  expect(gastoPorCategoria(movs, cuentas, mes)).toEqual([
    { categoriaId: comida, importe: 3000 },
    { categoriaId: ocio, importe: 1000 },
  ]);
  expect(validarCopia(await crearCopia(d)).ok).toBe(true);
  await expect(registrarDevolucion({ ...datos, importe: 4001, operacionId: 'refund-too-much' }, d)).rejects.toThrow(
    'supera',
  );
  await expect(borrarMovimiento(id, d)).rejects.toThrow('devoluciones');
  await expect(actualizarMovimiento(id, movimiento(4000), d)).rejects.toThrow('devoluciones');
  await borrarMovimiento(ids[0], d);
  const luego = await estado();
  expect(resumenMes(luego.movs, luego.cuentas, mes).gastos).toBe(8000);
});
it('devuelve céntimos exactos de un pago dividido y rechaza fechas futuras y copias corruptas', async () => {
  const id = await crearMovimiento(
    {
      ...movimiento(4),
      reparto: [
        { categoriaId: comida, importe: 3 },
        { categoriaId: ocio, importe: 1 },
      ],
    },
    d,
  );
  await registrarDevolucion({ gastoId: id, importe: 1, fecha: hoy, cuentaId: banco, operacionId: 'a' }, d);
  await registrarDevolucion({ gastoId: id, importe: 3, fecha: hoy, cuentaId: banco, operacionId: 'b' }, d);
  const { cuentas, movs } = await estado();
  expect(resumenMes(movs, cuentas, mes).gastos).toBe(0);
  expect(patrimonio(cuentas, movs)).toBe(100000);
  await expect(
    registrarDevolucion({ gastoId: id, importe: 1, fecha: addDays(hoy, 1), cuentaId: banco, operacionId: 'future' }, d),
  ).rejects.toThrow();
  const copia = await crearCopia(d);
  expect(validarCopia(copia).ok).toBe(true);
  (
    copia.datos.movimientos.find((m) => (m as { devolucionDe?: string }).devolucionDe) as { devolucionDe: string }
  ).devolucionDe = 'missing';
  expect(validarCopia(copia).ok).toBe(false);
});
it('borrar una categoría combina las partes de pagos divididos y conserva sus devoluciones', async () => {
  const id = await crearMovimiento(movimiento(), d);
  await registrarDevolucion({ gastoId: id, importe: 4000, fecha: hoy, cuentaId: banco, operacionId: 'r' }, d);
  await borrarCategoria(comida, ocio, d);
  const copia = await crearCopia(d);
  expect(validarCopia(copia).ok).toBe(true);
  expect((await d.movimientos.get(id))?.reparto).toBeUndefined();
  expect((await d.movimientos.get(id))?.categoriaId).toBe(ocio);
});
it('los recordatorios solo incluyen activos que vencen hoy o antes, sin registrar dinero', async () => {
  const fijo = {
    id: 'f',
    nombre: 'Alquiler',
    tipo: 'gasto' as const,
    importe: 10000,
    periodo: 'mensual' as const,
    proximaFecha: hoy,
    diaCobro: Number(hoy.slice(-2)),
    cuentaId: banco,
    categoriaId: comida,
    activo: true,
    nota: '',
  };
  const cats = await d.categorias.toArray();
  const fichas = fichasRecurrentes(
    [
      fijo,
      { ...fijo, id: 'future', proximaFecha: addDays(hoy, 1) },
      { ...fijo, id: 'paused', activo: false },
      { ...fijo, id: 'income', tipo: 'ingreso', categoriaId: ingreso },
    ],
    [],
    cats,
  );
  expect(
    recurrentesPendientes(fichas, hoy)
      .map((f) => f.id)
      .sort(),
  ).toEqual(['f', 'income']);
  expect(await d.movimientos.count()).toBe(0);
});
it('omitir un periodo no mueve dinero; deshacer un pago antiguo no vuelve a cobrar periodos ya pagados', async () => {
  await guardarPagoFijo(
    {
      nombre: 'Alquiler',
      tipo: 'gasto',
      importe: 10000,
      periodo: 'mensual',
      proximaFecha: '2026-01-31',
      diaCobro: 31,
      cuentaId: banco,
      categoriaId: comida,
      activo: true,
      nota: '',
    },
    undefined,
    d,
  );
  const fijo = (await d.pagosFijos.toArray())[0];
  const pago = (periodoFecha: string) =>
    registrarPago(
      {
        origen: 'fijo',
        recurrenteId: fijo.id,
        periodoFecha,
        fecha: hoy,
        importe: 10000,
        cuentaId: banco,
        categoriaId: comida,
      },
      d,
    );
  await pago('2026-01-31');
  await pago('2026-02-28');
  await omitirPeriodo('fijo', fijo.id, '2026-03-31', d);
  expect(await d.movimientos.count()).toBe(2);
  const enero = (await d.pagosRegistrados.toArray()).find((p) => p.periodoFecha === '2026-01-31')!;
  await deshacerPago(enero.id, d);
  expect((await d.pagosFijos.get(fijo.id))?.proximaFecha).toBe('2026-01-31');
  await pago('2026-01-31');
  expect((await d.pagosFijos.get(fijo.id))?.proximaFecha).toBe('2026-04-30');
  expect(await d.movimientos.count()).toBe(2);
  const nuevoEnero = (await d.pagosRegistrados.toArray()).find((p) => p.periodoFecha === '2026-01-31')!;
  await deshacerPago(nuevoEnero.id, d);
  await omitirPeriodo('fijo', fijo.id, '2026-01-31', d);
  expect((await d.pagosFijos.get(fijo.id))?.proximaFecha).toBe('2026-04-30');
  expect(await d.movimientos.count()).toBe(1);
});
it('el ahorro general inicial y los ingresos directos quedan asignados a una meta sin cambiar el patrimonio', async () => {
  const ahorro = await crearCuenta({ nombre: 'Ahorro', tipo: 'ahorro', ambito: 'personal', saldoInicial: 50000 }, d);
  await Promise.all([asignarAhorroGeneral(d), asignarAhorroGeneral(d)]);
  expect(await d.metas.count()).toBe(1);
  const meta = (await d.metas.toArray())[0];
  let { cuentas, movs } = await estado();
  expect(dineroMeta(meta, await d.aportesMetas.toArray(), cuentas, movs).disponible).toBe(50000);
  expect(patrimonio(cuentas, movs)).toBe(150000);
  await crearMovimiento(
    { tipo: 'transferencia', importe: 10000, fecha: hoy, cuentaId: banco, cuentaDestinoId: ahorro, nota: '' },
    d,
  );
  await asignarAhorroGeneral(d);
  ({ cuentas, movs } = await estado());
  expect(dineroMeta(meta, await d.aportesMetas.toArray(), cuentas, movs).disponible).toBe(60000);
  expect(dineroDisponible(cuentas, movs)).toEqual({ total: 150000, ahorro: 60000, disponible: 90000 });
  expect(cuentas.filter((c) => !c.cuentaPadreId)).toHaveLength(2);
});
it('lee CSV con BOM, separadores, comillas, líneas internas, fechas e importes españoles y filtra futuros', async () => {
  const csv = leerCSV(
    '\uFEFFFecha;Concepto;Importe\r\n04/11/2026;"Compra; tienda";-1.234,56\r\n05/11/2026;"Nota ""doble""\nsegunda línea";250,00',
  );
  expect(csv.filas).toHaveLength(2);
  const filas = prepararCSV(csv.filas, { fecha: 0, nota: 1, importe: 2, modo: 'signo' }, banco, [], '2026-11-04');
  expect(filas[0]).toMatchObject({ fecha: '2026-11-04', importe: 123456, tipo: 'gasto', nota: 'Compra; tienda' });
  expect(filas[1].error).toBe('Fecha futura');
  expect(() => leerCSV('Fecha;Concepto;Importe\n"sin cerrar')).toThrow();
});
it('importar CSV detecta duplicados por cuenta y ocurrencia y puede conservar el saldo actual', async () => {
  const filas = [
      [hoy, 'Compra', '-80,00'],
      [hoy, 'Compra', '-80,00'],
      [hoy, 'Ingreso', '100,00'],
    ],
    columnas = { fecha: 0, nota: 1, importe: 2, modo: 'signo' as const };
  await crearMovimiento({ ...movimiento(), reparto: undefined }, d);
  expect(prepararCSV(filas, columnas, banco, await d.movimientos.toArray()).map((f) => f.duplicado)).toEqual([
    true,
    false,
    false,
  ]);
  const datos = {
    filas,
    columnas,
    cuentaId: banco,
    seleccion: [
      { linea: 3, categoriaId: comida, permitirDuplicado: false },
      { linea: 4, categoriaId: ingreso, permitirDuplicado: false },
    ],
    conservarSaldo: true,
    loteId: 'lote',
  };
  expect(await importarCSV(datos, d)).toEqual({ guardados: 2, omitidos: 0 });
  const { cuentas, movs } = await estado();
  expect(patrimonio(cuentas, movs)).toBe(92000);
  expect(await importarCSV(datos, d)).toEqual({ guardados: 0, omitidos: 2 });
  expect(await d.movimientos.count()).toBe(3);
});
it('las nuevas copias preservan revisión mensual, reparto, devoluciones y periodos omitidos', async () => {
  await guardarPresupuesto({ mes: '2026-10', categoriaId: comida, limite: 30000 }, undefined, d);
  await asegurarPlanMes(mes, d);
  const id = await crearMovimiento(movimiento(), d);
  await registrarDevolucion({ gastoId: id, importe: 1000, fecha: hoy, cuentaId: banco, operacionId: 'refund' }, d);
  const copia = await crearCopia(d);
  expect(copia.version).toBe(10);
  expect(validarCopia(copia).ok).toBe(true);
  await restaurarCopia(copia, d);
  expect(await crearCopia(d, new Date(copia.exportadaEn))).toEqual(copia);
});

it('una devolución de un mes anterior se cuenta en su fecha real y no se oculta en el desglose', async () => {
  const gasto = await crearMovimiento({ ...movimiento(10000), fecha: '2026-10-01' }, d);
  await registrarDevolucion(
    { gastoId: gasto, importe: 8000, fecha: hoy, cuentaId: banco, operacionId: 'old-refund' },
    d,
  );
  const { cuentas, movs } = await estado();
  expect(resumenMes(movs, cuentas, mes)).toMatchObject({ ingresos: 0, gastos: -8000, neto: 8000 });
  expect(gastoPorCategoria(movs, cuentas, mes).reduce((s, p) => s + p.importe, 0)).toBe(-8000);
});
it('devuelve céntimos entre muchas categorías sin superar el importe original de ninguna', async () => {
  const cats = (await d.categorias.where('tipo').equals('gasto').toArray()).slice(0, 5);
  const reparto = cats.map((c) => ({ categoriaId: c.id, importe: 1 }));
  const id = await crearMovimiento({ ...movimiento(5), importe: 5, categoriaId: cats[0].id, reparto }, d);
  await registrarDevolucion({ gastoId: id, importe: 4, fecha: hoy, cuentaId: banco, operacionId: 'cents' }, d);
  expect(validarCopia(await crearCopia(d)).ok).toBe(true);
});
it('CSV sin conservar saldo cambia el total y una fila inválida revierte toda la importación', async () => {
  const columnas = { fecha: 0, nota: 1, importe: 2, modo: 'signo' as const },
    datos = {
      filas: [[hoy, 'Cargo', '-25,00']],
      columnas,
      cuentaId: banco,
      seleccion: [{ linea: 2, categoriaId: comida, permitirDuplicado: false }],
      conservarSaldo: false,
      loteId: 'new',
    };
  await importarCSV(datos, d);
  let e = await estado();
  expect(patrimonio(e.cuentas, e.movs)).toBe(97500);
  await expect(
    importarCSV(
      {
        ...datos,
        loteId: 'invalid',
        filas: [
          [hoy, 'Otro cargo', '-10,00'],
          ['fecha rota', 'Mal', '-2,00'],
        ],
        seleccion: [
          { linea: 2, categoriaId: comida, permitirDuplicado: false },
          { linea: 3, categoriaId: comida, permitirDuplicado: false },
        ],
      },
      d,
    ),
  ).rejects.toThrow('Revisa');
  e = await estado();
  expect(patrimonio(e.cuentas, e.movs)).toBe(97500);
  expect(e.movs).toHaveLength(1);
});
