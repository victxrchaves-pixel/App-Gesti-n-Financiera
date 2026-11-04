import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NetoDB } from './db';
import { borrarCategoria, borrarTodo, completarInicio, crearCuenta, crearMovimiento, actualizarMovimiento, borrarMovimiento } from './repo';
import { guardarPresupuesto, copiarPresupuestos, borrarPresupuesto } from './budgets';
import { estadoPresupuesto, gastosPresupuesto, resumenPresupuestos, seriePresupuesto } from '../lib/budgets';
import { crearCopia, restaurarCopia, validarCopia } from '../lib/backup';

let d: NetoDB; let n = 0; let comida: string; let ocio: string; let personal: string; let negocio: string;
beforeEach(async () => {
  d = new NetoDB(`budget-${++n}`); await d.open(); await completarInicio({ nombre:'Alex', autonomo:true }, d);
  const cats = await d.categorias.toArray(); comida = cats.find(c => c.nombre === 'Comida')!.id; ocio = cats.find(c => c.nombre === 'Ocio')!.id;
  personal = await crearCuenta({ nombre:'Banco', tipo:'banco', ambito:'personal', saldoInicial:0 }, d);
  negocio = await crearCuenta({ nombre:'Negocio', tipo:'banco', ambito:'negocio', saldoInicial:0 }, d);
});
afterEach(async () => { await d.delete(); });
const mes = '2026-11'; const hoy = '2026-11-04';
const gasto = (cuentaId: string, categoriaId: string, importe = 1000, fecha = hoy) => ({ tipo:'gasto' as const, cuentaId, categoriaId, importe, fecha, nota:'' });
async function resumen() { return resumenPresupuestos(await d.presupuestos.where('mes').equals(mes).toArray(), gastosPresupuesto(await d.movimientos.toArray(), await d.cuentas.toArray(), mes, hoy)); }

describe('presupuestos mensuales', () => {
  it('valida importes, fechas, categorías y evita duplicados incluso con escrituras simultáneas', async () => {
    await expect(guardarPresupuesto({ mes:'2026-13', categoriaId:comida, limite:100 }, undefined, d)).rejects.toThrow('mes');
    for (const limite of [0, -1, .5, Infinity, Number.MAX_SAFE_INTEGER + 1]) await expect(guardarPresupuesto({ mes, categoriaId:comida, limite }, undefined, d)).rejects.toThrow('límite');
    const ingreso = (await d.categorias.where('tipo').equals('ingreso').first())!.id;
    await expect(guardarPresupuesto({ mes, categoriaId:ingreso, limite:100 }, undefined, d)).rejects.toThrow('categoría');
    const resultados = await Promise.allSettled([1, 2].map(() => guardarPresupuesto({ mes, categoriaId:comida, limite:100 }, undefined, d)));
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await d.presupuestos.count()).toBe(1);
  });
  it('cuenta solo gastos personales hasta hoy e incluye cuentas archivadas', async () => {
    await guardarPresupuesto({ mes, categoriaId:comida, limite:2000 }, undefined, d);
    await crearMovimiento(gasto(personal, comida, 800), d); await crearMovimiento(gasto(personal, ocio, 300), d);
    await crearMovimiento(gasto(negocio, comida, 900), d);
    await crearMovimiento(gasto(personal, comida, 600, '2026-10-31'), d);
    await crearMovimiento(gasto(personal, comida, 500, '2026-11-05'), d);
    await crearMovimiento({ ...gasto(personal, comida, 400), tipo:'ingreso' }, d);
    await crearMovimiento({ ...gasto(personal, comida, 200), tipo:'transferencia', cuentaDestinoId:negocio }, d);
    await d.cuentas.update(personal, { archivada:true });
    expect(await resumen()).toMatchObject({ limite:2000, gastado:800, restante:1200, sinPresupuesto:300 });
  });
  it('recalcula al editar, cambiar de categoría y borrar un gasto', async () => {
    await guardarPresupuesto({ mes, categoriaId:comida, limite:2000 }, undefined, d);
    const id = await crearMovimiento(gasto(personal, comida, 1600), d);
    expect((await resumen()).gastado).toBe(1600);
    await actualizarMovimiento(id, gasto(personal, comida, 2100), d); expect((await resumen()).restante).toBe(-100);
    await actualizarMovimiento(id, gasto(personal, ocio, 2100), d); expect((await resumen()).sinPresupuesto).toBe(2100);
    await borrarMovimiento(id, d); expect((await resumen()).sinPresupuesto).toBe(0);
  });
  it('distingue el 80 %, el límite exacto y el exceso', () => {
    expect(estadoPresupuesto(79, 100)).toBe('Dentro del límite'); expect(estadoPresupuesto(80, 100)).toBe('Cerca del límite');
    expect(estadoPresupuesto(100, 100)).toBe('Límite alcanzado'); expect(estadoPresupuesto(101, 100)).toBe('Superado');
  });
  it('copia solo categorías ausentes sin modificar límites, meses anteriores ni movimientos', async () => {
    await guardarPresupuesto({ mes:'2026-10', categoriaId:comida, limite:10000 }, undefined, d);
    await guardarPresupuesto({ mes:'2026-10', categoriaId:ocio, limite:5000 }, undefined, d);
    await guardarPresupuesto({ mes, categoriaId:comida, limite:20000 }, undefined, d);
    expect(await copiarPresupuestos('2026-10', mes, d)).toBe(1); expect(await copiarPresupuestos('2026-10', mes, d)).toBe(0);
    expect((await resumen()).limite).toBe(25000);
    expect((await d.presupuestos.where('mes').equals('2026-10').toArray()).reduce((s, p) => s + p.limite, 0)).toBe(15000);
    expect(await d.movimientos.count()).toBe(0);
  });
  it('eliminar un presupuesto conserva los gastos y los muestra sin límite', async () => {
    const id = await guardarPresupuesto({ mes, categoriaId:comida, limite:2000 }, undefined, d);
    await crearMovimiento(gasto(personal, comida), d); await borrarPresupuesto(id, d);
    expect(await resumen()).toMatchObject({ limite:0, gastado:0, sinPresupuesto:1000 });
  });
  it('eliminar una categoría traslada y suma sus límites por mes sin perder gastos', async () => {
    await guardarPresupuesto({ mes, categoriaId:comida, limite:1000 }, undefined, d);
    await guardarPresupuesto({ mes, categoriaId:ocio, limite:2000 }, undefined, d);
    await guardarPresupuesto({ mes:'2026-12', categoriaId:comida, limite:4000 }, undefined, d);
    await crearMovimiento(gasto(personal, comida, 500), d);
    await borrarCategoria(comida, ocio, d);
    expect(await d.presupuestos.where('categoriaId').equals(comida).count()).toBe(0);
    expect((await resumen()).filas).toMatchObject([{ categoriaId:ocio, limite:3000, gastado:500 }]);
    expect((await d.presupuestos.where('mes').equals('2026-12').first())?.categoriaId).toBe(ocio);
  });
  it('traza los días correctos, acumula céntimos y no inventa días futuros', async () => {
    await crearMovimiento(gasto(personal, comida, 125, '2026-11-01'), d); await crearMovimiento(gasto(personal, comida, 250, hoy), d);
    const movimientos = await d.movimientos.toArray();
    expect(seriePresupuesto(movimientos, mes, hoy).puntos.map(p => p.gastado)).toEqual([125, 125, 125, 375]);
    expect(seriePresupuesto([], '2028-02', '2028-03-01').puntos).toHaveLength(29);
    expect(seriePresupuesto([], '2026-02', hoy).puntos).toHaveLength(28);
    expect(seriePresupuesto([], '2026-12', hoy).puntos).toHaveLength(0);
  });
  it('protege los límites totales ante desbordamientos', async () => {
    await guardarPresupuesto({ mes, categoriaId:comida, limite:Number.MAX_SAFE_INTEGER }, undefined, d);
    await expect(guardarPresupuesto({ mes, categoriaId:ocio, limite:1 }, undefined, d)).rejects.toThrow('total');
    expect(await d.presupuestos.count()).toBe(1);
  });
  it('incluye presupuestos en copias y rechaza duplicados o referencias rotas antes de restaurar', async () => {
    await guardarPresupuesto({ mes, categoriaId:comida, limite:30000 }, undefined, d);
    const copia = await crearCopia(d); expect(copia.version).toBe(3); expect(validarCopia(copia).ok).toBe(true);
    await borrarTodo(d); await restaurarCopia(copia, d); expect(await crearCopia(d, new Date(copia.exportadaEn))).toEqual(copia);
    const roto = structuredClone(copia); (roto.datos.presupuestos[0] as { categoriaId:string }).categoriaId='no-existe'; expect(validarCopia(roto).ok).toBe(false);
    const duplicado = structuredClone(copia); duplicado.datos.presupuestos.push({ ...(duplicado.datos.presupuestos[0] as object), id:'otro' }); expect(validarCopia(duplicado).ok).toBe(false);
    expect(validarCopia({ app:'neto', version:2, datos:{} }).ok).toBe(true);
  });
  it('migra una base v2 conservando suscripciones y cuentas', async () => {
    const vieja = new Dexie('budgets-legacy');
    vieja.version(2).stores({ cuentas:'id, ambito, orden', movimientos:'id, fecha, cuentaId, cuentaDestinoId, categoriaId, tipo', categorias:'id, tipo, orden', ajustes:'id', suscripciones:'id, ambito, estado, categoria, proximaFecha', inversiones:'id, tipo, activoId', historialCartera:'id, fecha' });
    await vieja.table('cuentas').put({ id:'cuenta', saldoInicial:123 }); await vieja.table('suscripciones').put({ id:'sub', nombre:'ADG-FAD' }); vieja.close();
    const nueva = new NetoDB('budgets-legacy'); await nueva.open();
    expect((await nueva.cuentas.get('cuenta'))?.saldoInicial).toBe(123); expect((await nueva.suscripciones.get('sub'))?.nombre).toBe('ADG-FAD');
    expect(await nueva.presupuestos.count()).toBe(0); await nueva.delete();
  });
});
