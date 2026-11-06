import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { NetoDB } from './db';
import { guardarMeta, sincronizarMetas, aportarMeta, gastarMeta, reasignarAhorro, borrarMeta } from './goals';
import { crearCuenta, crearMovimiento, completarInicio, borrarCuenta, actualizarCuenta } from './repo';
import { crearCopia, validarCopia, restaurarCopia } from '../lib/backup';
import { patrimonio, dineroDisponible, saldosPorCuenta } from '../lib/balances';
import { dineroMeta } from '../lib/goalMoney';
import { todayISO, monthKey, addMonths, addDays } from '../lib/dates';
let d:NetoDB; let n=0; let cuenta:string; let gasto:string;
const mes=()=>monthKey(todayISO());
const base={nombre:'Japón',objetivo:100000,inicial:0,mensual:10000,mesInicio:'2026-01',automatica:true,activa:true,categoriaAhorro:'viajes'};
beforeEach(async()=>{d=new NetoDB('goals-'+ ++n);await d.open();await completarInicio({nombre:'Alex',autonomo:false},d);cuenta=await crearCuenta({nombre:'General',tipo:'banco',ambito:'personal',saldoInicial:100000},d);gasto=(await d.categorias.where('tipo').equals('gasto').first())!.id});
afterEach(async()=>{await d.delete()});
const estado=async(id:string)=>dineroMeta((await d.metas.get(id))!,await d.aportesMetas.toArray(),await d.cuentas.toArray(),await d.movimientos.toArray());
it('reserva solo el mes actual, sin atrasos ni movimientos futuros, una sola vez aunque haya concurrencia',async()=>{
 const id=await guardarMeta({...base,cuentaOrigenId:cuenta,mesInicio:addMonths(mes(),-3)},undefined,d);
 await Promise.all([sincronizarMetas(mes(),d),sincronizarMetas(mes(),d)]);await sincronizarMetas(addMonths(mes(),1),d);
 expect((await d.aportesMetas.toArray()).map(a=>[a.metaId,a.mes,a.importe])).toEqual([[id,mes(),10000]]);expect((await d.movimientos.toArray()).map(m=>m.fecha)).toEqual([todayISO()]);
});
it('no inventa aportaciones sin cuenta, en modo manual o con inicio futuro',async()=>{
 await guardarMeta(base,undefined,d);await guardarMeta({...base,cuentaOrigenId:cuenta,automatica:false},undefined,d);await guardarMeta({...base,cuentaOrigenId:cuenta,mesInicio:addMonths(mes(),1)},undefined,d);
 expect(await d.aportesMetas.count()).toBe(0);expect(await d.movimientos.count()).toBe(0);
});
it('recuperar tres meses transfiere 300 una vez y reparte 100 por periodo, sin sobrescribir aportaciones previas',async()=>{
 const id=await guardarMeta({...base,cuentaOrigenId:cuenta,automatica:false},undefined,d);const meses=[addMonths(mes(),-2),addMonths(mes(),-1),mes()];
 await Promise.all([aportarMeta(id,30000,meses,todayISO(),'recovery',d),aportarMeta(id,30000,meses,todayISO(),'recovery',d)]);
 const aportes=await d.aportesMetas.orderBy('mes').toArray();expect(aportes.map(a=>a.importe)).toEqual([10000,10000,10000]);expect(new Set(aportes.map(a=>a.movimientoId)).size).toBe(1);expect(await d.movimientos.count()).toBe(1);
 await aportarMeta(id,2000,[mes()],todayISO(),'extra',d);expect((await estado(id)).aportado).toBe(32000);expect(await d.aportesMetas.count()).toBe(4);expect(await d.movimientos.count()).toBe(2);
 const dinero=dineroDisponible(await d.cuentas.toArray(),await d.movimientos.toArray());expect(dinero).toEqual({total:100000,ahorro:32000,disponible:68000});
});
it('reparte céntimos sin perder dinero y las etiquetas futuras no fechan movimientos futuros',async()=>{
 const id=await guardarMeta({...base,cuentaOrigenId:cuenta,automatica:false},undefined,d);await aportarMeta(id,10001,[mes(),addMonths(mes(),1),addMonths(mes(),2)],todayISO(),'rounding',d);
 expect((await d.aportesMetas.orderBy('mes').toArray()).map(a=>a.importe)).toEqual([3334,3334,3333]);expect((await estado(id)).aportado).toBe(10001);expect((await d.movimientos.toArray())[0].fecha).toBe(todayISO());
});
it('editar o borrar la transferencia reparte el cambio y no recrea la reserva anulada',async()=>{
 const id=await guardarMeta({...base,cuentaOrigenId:cuenta,automatica:false},undefined,d);await aportarMeta(id,30000,[addMonths(mes(),-2),addMonths(mes(),-1),mes()],todayISO(),'bulk',d);
 const mov=(await d.movimientos.toArray())[0];await d.movimientos.update(mov.id,{importe:24000});await sincronizarMetas(mes(),d);expect((await d.aportesMetas.toArray()).map(a=>a.importe)).toEqual([8000,8000,8000]);
 await d.movimientos.delete(mov.id);await d.metas.update(id,{automatica:true});await sincronizarMetas(mes(),d);expect((await d.aportesMetas.toArray()).map(a=>a.importe)).toEqual([0,0,0]);expect(await d.movimientos.count()).toBe(0);
});
it('reserva 200, registra 150 en vuelos y devuelve los 50 restantes sin otro gasto',async()=>{
 const id=await guardarMeta({...base,cuentaOrigenId:cuenta,automatica:false,desglose:[{id:'vuelos',nombre:'Vuelos',importe:20000}]},undefined,d);await aportarMeta(id,20000,[mes()],todayISO(),'reserve',d);
 const datos={metaId:id,partidaId:'vuelos',importe:15000,fecha:todayISO(),categoriaId:gasto,nota:'Billetes',operacionId:'expense'};
 await Promise.all([gastarMeta(datos,d),gastarMeta(datos,d)]);expect(await estado(id)).toMatchObject({aportado:20000,gastado:15000,disponible:5000,progreso:20000});
 const reparto={metaId:id,cuentaDestinoId:cuenta,importe:5000,fecha:todayISO(),operacionId:'refund'};await reasignarAhorro(reparto,d);await reasignarAhorro(reparto,d);
 expect(await estado(id)).toMatchObject({gastado:15000,retirado:5000,disponible:0,progreso:15000});expect(await d.movimientos.count()).toBe(3);expect(patrimonio(await d.cuentas.toArray(),await d.movimientos.toArray(),'personal')).toBe(85000);expect(dineroDisponible(await d.cuentas.toArray(),await d.movimientos.toArray()).disponible).toBe(85000);
});
it('reparte sobrante a otra meta y conserva el total de dinero entre cuentas',async()=>{
 const origen=await guardarMeta({...base,cuentaOrigenId:cuenta,automatica:false},undefined,d);const destino=await guardarMeta({...base,nombre:'Emergencia',categoriaAhorro:'ahorro',automatica:false},undefined,d);await aportarMeta(origen,20000,[mes()],todayISO(),'reserve',d);
 await reasignarAhorro({metaId:origen,destinoMetaId:destino,importe:5000,fecha:todayISO(),operacionId:'other-goal'},d);
 expect((await estado(origen)).disponible).toBe(15000);expect(await estado(destino)).toMatchObject({aportado:5000,disponible:5000});expect(patrimonio(await d.cuentas.toArray(),await d.movimientos.toArray(),'personal')).toBe(100000);
});
it('no permite gastar o aportar sin saldo, con fecha futura o un concepto inexistente; no quedan movimientos parciales',async()=>{
 const id=await guardarMeta({...base,cuentaOrigenId:cuenta,automatica:false},undefined,d);
 await expect(aportarMeta(id,100001,[mes()],todayISO(),'too-much',d)).rejects.toThrow('saldo');await expect(aportarMeta(id,100,[mes()],addDays(todayISO(),1),'future',d)).rejects.toThrow('fecha');
 await expect(gastarMeta({metaId:id,importe:1,fecha:todayISO(),categoriaId:gasto,nota:'',operacionId:'empty'},d)).rejects.toThrow('saldo');expect(await d.movimientos.count()).toBe(0);
 await aportarMeta(id,10000,[mes()],todayISO(),'reserve',d);await expect(gastarMeta({metaId:id,partidaId:'missing',importe:1,fecha:todayISO(),categoriaId:gasto,nota:'',operacionId:'bad-part'},d)).rejects.toThrow('concepto');expect(await d.movimientos.count()).toBe(1);
});
it('no reserva sin saldo, reintenta tras cobrar y respeta el porcentaje y el objetivo',async()=>{
 await d.cuentas.update(cuenta,{saldoInicial:5000});const id=await guardarMeta({...base,objetivo:15000,cuentaOrigenId:cuenta,porcentaje:10,baseMensual:200000},undefined,d);expect(await d.movimientos.count()).toBe(0);expect((await d.metas.get(id))?.mensual).toBe(20000);
 const ingreso=(await d.categorias.where('tipo').equals('ingreso').first())!.id;await crearMovimiento({tipo:'ingreso',importe:30000,cuentaId:cuenta,categoriaId:ingreso,fecha:todayISO(),nota:''},d);await sincronizarMetas(mes(),d);expect((await estado(id)).aportado).toBe(15000);
});
it('elimina una cuenta de los totales, preserva el historial y pausa sus metas; no permite archivarla',async()=>{
 const id=await guardarMeta({...base,cuentaOrigenId:cuenta},undefined,d);await expect(actualizarCuenta(cuenta,{archivada:true},d)).rejects.toThrow('no se archivan');await borrarCuenta(cuenta,d);await sincronizarMetas(mes(),d);
 expect((await d.metas.get(id))?.activa).toBe(false);expect(await d.movimientos.count()).toBe(1);expect(dineroDisponible(await d.cuentas.toArray(),await d.movimientos.toArray())).toEqual({total:10000,ahorro:10000,disponible:0});expect(saldosPorCuenta(await d.cuentas.toArray(),await d.movimientos.toArray()).get(cuenta)).toBe(90000);
});
it('las copias v10 conservan reparto, viajes y cuentas eliminadas; detectan repartos que no cuadran y admiten v7',async()=>{
 const id=await guardarMeta({...base,cuentaOrigenId:cuenta,automatica:false},undefined,d);await aportarMeta(id,30000,[addMonths(mes(),-2),addMonths(mes(),-1),mes()],todayISO(),'bulk',d);await gastarMeta({metaId:id,importe:5000,fecha:todayISO(),categoriaId:gasto,nota:'Hotel',operacionId:'hotel'},d);await borrarCuenta(cuenta,d);
 const copia=await crearCopia(d);expect(copia.version).toBe(10);expect(validarCopia(copia).ok).toBe(true);await restaurarCopia(copia,d);expect(await crearCopia(d,new Date(copia.exportadaEn))).toEqual(copia);
 const mala=structuredClone(copia);(mala.datos.aportesMetas[0] as {importe:number}).importe++;expect(validarCopia(mala).ok).toBe(false);expect(validarCopia({app:'neto',version:7,datos:{}}).ok).toBe(true);
 const total=patrimonio(await d.cuentas.toArray(),await d.movimientos.toArray(),'personal');await borrarMeta(id,d);expect(await d.aportesMetas.count()).toBe(0);expect(await d.movimientos.count()).toBe(3);expect(patrimonio(await d.cuentas.toArray(),await d.movimientos.toArray(),'personal')).toBe(total);
});
it('migra v4 sin perder presupuestos o preferencias',async()=>{
 const vieja=new Dexie('goals-legacy');vieja.version(4).stores({categorias:'id',cuentas:'id',movimientos:'id',ajustes:'id',suscripciones:'id',inversiones:'id',historialCartera:'id',presupuestos:'id, mes, categoriaId, &[mes+categoriaId]'});await vieja.table('presupuestos').put({id:'p',mes:'2026-11',categoriaId:'c',limite:12300});await vieja.table('ajustes').put({id:'ajustes',colorAcento:'#123456'});vieja.close();const nueva=new NetoDB('goals-legacy');await nueva.open();expect((await nueva.presupuestos.get('p'))?.limite).toBe(12300);expect((await nueva.ajustes.get('ajustes'))?.colorAcento).toBe('#123456');expect(await nueva.pagosFijos.count()).toBe(0);await nueva.delete();
});
