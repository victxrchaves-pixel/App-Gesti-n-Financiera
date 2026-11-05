import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { NetoDB } from './db';
import { guardarMeta, sincronizarMetas, confirmarAporte, borrarMeta } from './goals';
import { crearCopia, validarCopia, restaurarCopia } from '../lib/backup';
import { todayISO, monthKey, addMonths } from '../lib/dates';
let d:NetoDB;let n=0;
const base={ nombre:'Viajes', objetivo:100000, inicial:0, mensual:10000, mesInicio:'2026-01', automatica:true, activa:true };
beforeEach(async()=>{d=new NetoDB('goals-'+ ++n);await d.open()});
afterEach(async()=>{await d.delete()});
it('asigna una vez por mes, recupera meses transcurridos y respeta el objetivo sin movimientos bancarios',async()=>{
 const id=await guardarMeta({...base,mesInicio:monthKey(todayISO()),objetivo:25000},undefined,d);
 const start=monthKey(todayISO());
 await Promise.all([sincronizarMetas(addMonths(start,2),d),sincronizarMetas(addMonths(start,2),d)]);
 const aportes=await d.aportesMetas.where('metaId').equals(id).sortBy('mes');
 expect(aportes.map(a=>a.importe)).toEqual([10000,10000,5000]);expect(await d.movimientos.count()).toBe(0);expect(await d.cuentas.count()).toBe(0);
});
it('confirmar sustituye la asignación del mes sin duplicar el ahorro',async()=>{
 const mes=monthKey(todayISO());const id=await guardarMeta({...base,mesInicio:mes},undefined,d);
 await confirmarAporte(id,mes,8000,d);await confirmarAporte(id,mes,8000,d);await sincronizarMetas(mes,d);
 const aportes=await d.aportesMetas.toArray();expect(aportes).toHaveLength(1);expect(aportes[0]).toMatchObject({importe:8000,origen:'confirmado'});
});
it('el modo manual y las metas futuras no reciben asignaciones automáticas',async()=>{
 await guardarMeta({...base,automatica:false},undefined,d);
 await guardarMeta({...base,mesInicio:addMonths(monthKey(todayISO()),1)},undefined,d);
 expect(await d.aportesMetas.count()).toBe(0);
});
it('cambiar la cuota no reescribe meses registrados; la nueva cuota se aplica a los siguientes',async()=>{
 const mes=monthKey(todayISO());const id=await guardarMeta({...base,mesInicio:mes},undefined,d);
 await guardarMeta({...base,mesInicio:mes,mensual:15000},id,d);
 await sincronizarMetas(addMonths(mes,1),d);
 expect((await d.aportesMetas.orderBy('mes').toArray()).map(a=>a.importe)).toEqual([10000,15000]);
});
it('pausar y reanudar no asigna dinero retrospectivamente a los meses de pausa',async()=>{
 const mes=monthKey(todayISO());const pasado=addMonths(mes,-2);
 const id=await guardarMeta({...base,automatica:false,activa:false,mesInicio:pasado},undefined,d);
 await d.metas.update(id,{pausadaDesde:pasado});
 await guardarMeta({...base,mesInicio:pasado},id,d);
 const aportes=await d.aportesMetas.orderBy('mes').toArray();expect(aportes.map(a=>a.importe)).toEqual([0,0,10000]);
});
it('valida importes y referencias, y borrar una meta elimina solo sus asignaciones',async()=>{
 await expect(guardarMeta({...base,mensual:-1},undefined,d)).rejects.toThrow('importes');
 const id=await guardarMeta({...base,mesInicio:monthKey(todayISO())},undefined,d);
 await expect(confirmarAporte('missing',monthKey(todayISO()),100,d)).rejects.toThrow('existe');
 await expect(confirmarAporte(id,addMonths(monthKey(todayISO()),1),100,d)).rejects.toThrow('válida');
 await borrarMeta(id,d);expect(await d.metas.count()).toBe(0);expect(await d.aportesMetas.count()).toBe(0);
});
it('copias incluyen metas/aportaciones y rechazan duplicados y referencias rotas',async()=>{
 await guardarMeta({...base,mesInicio:monthKey(todayISO())},undefined,d);const copia=await crearCopia(d);expect(validarCopia(copia).ok).toBe(true);
 await borrarMeta((await d.metas.toArray())[0].id,d);await restaurarCopia(copia,d);expect(await crearCopia(d,new Date(copia.exportadaEn))).toEqual(copia);
 const repetida=structuredClone(copia);repetida.datos.aportesMetas.push({...repetida.datos.aportesMetas[0] as object,id:'otro'});expect(validarCopia(repetida).ok).toBe(false);
 const rota=structuredClone(copia);rota.datos.metas=[];expect(validarCopia(rota).ok).toBe(false);
 expect(validarCopia({app:'neto',version:4,datos:{}}).ok).toBe(true);
});
it('migra v4 sin perder presupuestos o preferencias',async()=>{
 const vieja=new Dexie('goals-legacy');vieja.version(4).stores({categorias:'id',cuentas:'id',movimientos:'id',ajustes:'id',suscripciones:'id',inversiones:'id',historialCartera:'id',presupuestos:'id, mes, categoriaId, &[mes+categoriaId]'});
 await vieja.table('presupuestos').put({id:'p',mes:'2026-11',categoriaId:'c',limite:12300});await vieja.table('ajustes').put({id:'ajustes',colorAcento:'#123456'});vieja.close();
 const nueva=new NetoDB('goals-legacy');await nueva.open();expect((await nueva.presupuestos.get('p'))?.limite).toBe(12300);expect((await nueva.ajustes.get('ajustes'))?.colorAcento).toBe('#123456');expect(await nueva.metas.count()).toBe(0);await nueva.delete();
});

it('reparte 100 a ahorro y 100 a viajes desde una cuenta sin alterar patrimonio ni duplicar transferencias',async()=>{
 const {crearCuenta}=await import('./repo');const {saldosPorCuenta,patrimonio}=await import('../lib/balances');
 const cuenta=await crearCuenta({nombre:'General',tipo:'banco',ambito:'personal',saldoInicial:100000},d);const mes=monthKey(todayISO());
 const japon=await guardarMeta({...base,nombre:'Japón',mesInicio:mes,cuentaOrigenId:cuenta},undefined,d);
 await guardarMeta({...base,nombre:'Ahorro',mesInicio:mes,cuentaOrigenId:cuenta},undefined,d);
 await Promise.all([sincronizarMetas(mes,d),sincronizarMetas(mes,d)]);
 const cuentas=await d.cuentas.toArray();const movimientos=await d.movimientos.toArray();const saldos=saldosPorCuenta(cuentas,movimientos);
 expect(saldos.get(cuenta)).toBe(80000);expect(saldos.get((await d.metas.get(japon))!.cuentaAhorroId!)).toBe(10000);expect(movimientos).toHaveLength(2);expect(movimientos.every(m=>m.tipo==='transferencia')).toBe(true);expect(patrimonio(cuentas,movimientos,'personal')).toBe(100000);
});
it('no reserva sin saldo, reintenta al ingresar y calcula un porcentaje sobre el ingreso de referencia',async()=>{
 const {crearCuenta,crearMovimiento}=await import('./repo');const cuenta=await crearCuenta({nombre:'General',tipo:'banco',ambito:'personal',saldoInicial:5000},d);const mes=monthKey(todayISO());
 const id=await guardarMeta({...base,mesInicio:mes,cuentaOrigenId:cuenta,porcentaje:10,baseMensual:200000},undefined,d);
 expect((await d.metas.get(id))?.mensual).toBe(20000);expect(await d.movimientos.count()).toBe(0);expect(await d.aportesMetas.count()).toBe(0);
 await crearMovimiento({tipo:'ingreso',importe:30000,cuentaId:cuenta,categoriaId:'nomina',fecha:todayISO(),nota:''},d);await sincronizarMetas(mes,d);
 expect((await d.aportesMetas.toArray())[0]).toMatchObject({importe:20000,origen:'transferencia'});
 const copia=await crearCopia(d);expect(validarCopia(copia).ok).toBe(true);
});
it('editar o borrar una reserva en Movimientos actualiza la meta sin recrear otra transferencia',async()=>{
 const {crearCuenta}=await import('./repo');const cuenta=await crearCuenta({nombre:'General',tipo:'banco',ambito:'personal',saldoInicial:50000},d);const mes=monthKey(todayISO());
 await guardarMeta({...base,mesInicio:mes,cuentaOrigenId:cuenta},undefined,d);const aporte=(await d.aportesMetas.toArray())[0];
 await d.movimientos.update(aporte.movimientoId!,{importe:8000});await sincronizarMetas(mes,d);expect((await d.aportesMetas.get(aporte.id))?.importe).toBe(8000);
 await d.movimientos.delete(aporte.movimientoId!);await sincronizarMetas(mes,d);expect((await d.aportesMetas.get(aporte.id))?.importe).toBe(0);expect(await d.movimientos.count()).toBe(0);
});
it('enlazar una meta ya planificada convierte la asignación actual en reserva sin duplicar el progreso',async()=>{
 const {crearCuenta}=await import('./repo');const mes=monthKey(todayISO());const id=await guardarMeta({...base,mesInicio:mes},undefined,d);
 const cuenta=await crearCuenta({nombre:'General',tipo:'banco',ambito:'personal',saldoInicial:50000},d);
 await guardarMeta({...base,mesInicio:mes,cuentaOrigenId:cuenta},id,d);
 const aportes=await d.aportesMetas.where('metaId').equals(id).toArray();expect(aportes).toHaveLength(1);expect(aportes[0]).toMatchObject({importe:10000,origen:'transferencia'});expect(await d.movimientos.count()).toBe(1);
});
