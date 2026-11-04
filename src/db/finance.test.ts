import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NetoDB } from './db';
import { aplicarCotizaciones, borrarInversion, guardarInversion, guardarSuscripcion, renovarSuscripcion } from './finance';
import { costeAnual, costeMensual, siguienteRenovacion } from '../lib/subscriptions';
import { parseDecimal, valorInversion } from '../lib/investments';
import { crearCopia, restaurarCopia, validarCopia } from '../lib/backup';
import { borrarTodo, crearCuenta } from './repo';
import type { Inversion, Suscripcion } from './types';
let db: NetoDB; let n = 0;
beforeEach(async () => { db = new NetoDB(`finance-${++n}`); await db.open(); });
afterEach(async () => { await db.delete(); });
const subscription: Omit<Suscripcion, 'id'> = { nombre: 'ADG-FAD', categoria: 'Asociaciones', ambito: 'negocio', importe: 1200, periodo: 'mensual', proximaFecha: '2026-01-31', diaCobro: 31, estado: 'activa', nota: '' };
const investment: Omit<Inversion, 'id'> = { nombre: 'Bitcoin', tipo: 'cripto', activoId: 'bitcoin', cantidad: .25, coste: 1000000, precioEUR: 60000, precioFecha: '2026-11-01T12:00:00Z', fuente: 'CoinGecko', nota: '' };

describe('suscripciones', () => {
 it('conserva el día 31 tras febrero y recupera el día original en marzo', () => {
  const s = { ...subscription, id: 's' };
  expect(siguienteRenovacion(s)).toBe('2026-02-28');
  expect(siguienteRenovacion({ ...s, proximaFecha: '2026-02-28' })).toBe('2026-03-31');
  expect(siguienteRenovacion({ ...s, proximaFecha: '2028-01-31' })).toBe('2028-02-29');
 });
 it('calcula cuotas anuales y trimestrales sin confundir el coste mensual con un cobro', () => {
  const s = { ...subscription, id:'s', importe: 10000, periodo:'anual' as const };
  expect(costeMensual(s)).toBe(833); expect(costeAnual(s)).toBe(10000);
  expect(costeMensual({ ...s, periodo:'trimestral' })).toBe(3333);
  expect(costeAnual({ ...s, periodo:'trimestral' })).toBe(40000);
 });
 it('evita avanzar dos cuotas por una doble pulsación y no crea movimientos', async () => {
  const id = await guardarSuscripcion(subscription, undefined, db);
  await Promise.all([renovarSuscripcion(id, subscription.proximaFecha, db), renovarSuscripcion(id, subscription.proximaFecha, db)]);
  expect((await db.suscripciones.get(id))?.proximaFecha).toBe('2026-02-28');
  expect(await db.movimientos.count()).toBe(0);
 });
 it('no renueva planes cancelados y rechaza fechas o importes inválidos', async () => {
  const id=await guardarSuscripcion({ ...subscription, estado:'cancelada' }, undefined, db);
  await expect(renovarSuscripcion(id, subscription.proximaFecha, db)).rejects.toThrow('activa');
  await expect(guardarSuscripcion({ ...subscription, proximaFecha:'2026-02-30' }, undefined, db)).rejects.toThrow('fecha');
  await expect(guardarSuscripcion({ ...subscription, importe:-5 }, undefined, db)).rejects.toThrow('importe');
 });
});
describe('cartera', () => {
 it('acepta unidades fraccionadas y redondea la valoración a céntimos', () => {
  expect(parseDecimal('0,00000001')).toBe(.00000001);expect(parseDecimal('1.000,50')).toBeNull();
  expect(valorInversion({ cantidad:.25, precioEUR:60000 })).toBe(1500000);
  expect(valorInversion({ cantidad:1, precioEUR:1.005 })).toBe(101);
 });
 it('actualiza precios sin alterar unidades ni coste y rechaza cotizaciones más antiguas', async () => {
  const id=await guardarInversion(investment, undefined, db);
  expect(await aplicarCotizaciones([{id:'bitcoin',precioEUR:65000,fecha:'2026-11-02T12:00:00Z',fuente:'CoinGecko'}], db)).toBe(1);
  expect(await aplicarCotizaciones([{id:'bitcoin',precioEUR:65000,fecha:'2026-11-02T12:00:00Z',fuente:'CoinGecko'}], db)).toBe(0);
  await aplicarCotizaciones([{id:'bitcoin',precioEUR:50000,fecha:'2026-10-01T12:00:00Z',fuente:'CoinGecko'}], db);
  expect(await db.inversiones.get(id)).toMatchObject({ cantidad:.25,coste:1000000,precioEUR:65000 });
  expect(await db.historialCartera.count()).toBe(2);
  expect((await db.historialCartera.orderBy('fecha').last())?.total).toBe(1625000);
 });
 it('mantiene las valoraciones manuales y registra las bajas en el histórico', async () => {
  const id=await guardarInversion({ ...investment, activoId:null, fuente:'Manual' }, undefined, db);
  expect(await aplicarCotizaciones([{id:'bitcoin',precioEUR:70000,fecha:'2026-11-03T12:00:00Z',fuente:'CoinGecko'}],db)).toBe(0);
  await borrarInversion(id,db);expect(await db.inversiones.count()).toBe(0);
  expect((await db.historialCartera.orderBy('fecha').last())?.total).toBe(0);
  expect((await db.historialCartera.orderBy('fecha').first())?.total).toBe(1500000);
 });
 it('una valoración inválida revierte la actualización y conserva el historial', async () => {
  const id=await guardarInversion(investment,undefined,db);
  await expect(aplicarCotizaciones([{id:'bitcoin',precioEUR:Infinity,fecha:'2026-11-03T12:00:00Z',fuente:'X'}],db)).rejects.toThrow();
  expect((await db.inversiones.get(id))?.precioEUR).toBe(60000);expect(await db.historialCartera.count()).toBe(1);
 });
});
describe('compatibilidad y copias', () => {
 it('abre una base v1 sin perder las cuentas existentes', async () => {
  const nombre='legacy-finance';const vieja=new Dexie(nombre);vieja.version(1).stores({ cuentas:'id, ambito, orden', movimientos:'id, fecha, cuentaId, cuentaDestinoId, categoriaId, tipo',categorias:'id, tipo, orden',ajustes:'id' });
  await vieja.table('cuentas').put({ id:'banco',saldoInicial:12345 });vieja.close();
  const nueva=new NetoDB(nombre);await nueva.open();expect((await nueva.cuentas.get('banco'))?.saldoInicial).toBe(12345);expect(await nueva.inversiones.count()).toBe(0);await nueva.delete();
 });
 it('incluye todos los datos nuevos en la copia, restauración y borrado', async () => {
  await crearCuenta({nombre:'Banco',tipo:'banco',ambito:'personal',saldoInicial:123},db);
  await guardarSuscripcion(subscription,undefined,db);await guardarInversion(investment,undefined,db);
  const copia=await crearCopia(db);const validada=validarCopia(JSON.parse(JSON.stringify(copia)));expect(validada.ok).toBe(true);
  await borrarTodo(db);expect(await db.historialCartera.count()).toBe(0);
  if(validada.ok)await restaurarCopia(validada.copia,db);
  expect(await crearCopia(db,new Date(copia.exportadaEn))).toEqual(copia);
 });
 it('acepta copias v1 y rechaza registros nuevos corruptos o duplicados', () => {
  expect(validarCopia({app:'neto',version:1,datos:{}}).ok).toBe(true);
  expect(validarCopia({app:'neto',version:2,datos:{suscripciones:[{...subscription,id:'s',nombre:42}]}}).ok).toBe(false);
  expect(validarCopia({app:'neto',version:2,datos:{inversiones:[{...investment,id:'i',cantidad:NaN}]}}).ok).toBe(false);
  expect(validarCopia({app:'neto',version:2,datos:{suscripciones:[{...subscription,id:'s'},{...subscription,id:'s'}]}}).ok).toBe(false);
 });
});
