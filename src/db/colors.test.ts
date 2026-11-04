import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NetoDB } from './db';
import { completarInicio, guardarAjustes, actualizarCategoria } from './repo';
import { guardarPresupuesto, copiarPresupuestos } from './budgets';
import { crearCopia, restaurarCopia, validarCopia } from '../lib/backup';
import { luminancia, tinta, variablesTema } from '../lib/colors';
let d:NetoDB;let n=0;
beforeEach(async()=>{d=new NetoDB('colors-'+ ++n);await completarInicio({nombre:'Alex',autonomo:false},d)});
afterEach(async()=>{await d.delete()});
it('empieza con categorías y tema neutros',async()=>{
 for(const c of await d.categorias.toArray()) expect(c.color.slice(1,3)).toBe(c.color.slice(3,5));
 expect(variablesTema()['--primary-ink']).toBe('#444444');
});
it('conserva colores independientes en copias y al copiar presupuestos',async()=>{
 const c=(await d.categorias.where('tipo').equals('gasto').first())!;
 await guardarAjustes({colorAcento:'#00aabb',colorIngresos:'#cc0033'},d);
 await actualizarCategoria(c.id,{color:'#f0a812'},d);
 await guardarPresupuesto({mes:'2026-11',categoriaId:c.id,limite:5000,color:'#3456ab'},undefined,d);
 await copiarPresupuestos('2026-11','2026-12',d);
 expect((await d.presupuestos.where('mes').equals('2026-12').first())?.color).toBe('#3456ab');
 const copia=await crearCopia(d);expect(validarCopia(copia).ok).toBe(true);
 await restaurarCopia(copia,d);expect(await crearCopia(d,new Date(copia.exportadaEn))).toEqual(copia);
 await guardarAjustes({colorAcento:null},d);
 expect(variablesTema(await d.ajustes.get('ajustes'))['--primary-ink']).toBe('#444444');
 expect((await d.categorias.get(c.id))?.color).toBe('#f0a812');
});
it('rechaza colores inseguros y mantiene contraste sobre blanco',async()=>{
 await expect(guardarAjustes({colorAcento:'red;display:none'},d)).rejects.toThrow('Color');
 for(const color of ['#ffffff','#ffff00','#00ff00','#abcdef','#000000']) expect(1.05/(luminancia(tinta(color))+.05)).toBeGreaterThanOrEqual(4.5);
 const copia=await crearCopia(d);(copia.datos.ajustes[0] as {colorAcento:string}).colorAcento='url(evil)';expect(validarCopia(copia).ok).toBe(false);
});
it('migra solo los colores iniciales heredados y conserva elecciones diferentes',async()=>{
 const vieja=new Dexie('old-colors');vieja.version(3).stores({categorias:'id, tipo, orden',ajustes:'id',cuentas:'id',movimientos:'id',suscripciones:'id',inversiones:'id',historialCartera:'id',presupuestos:'id, mes, categoriaId, &[mes+categoriaId]'});
 await vieja.table('categorias').bulkAdd([{id:'a',nombre:'Casa',color:'#8860B0'},{id:'b',nombre:'Comida',color:'#123456'}]);vieja.close();
 const nueva=new NetoDB('old-colors');await nueva.open();expect((await nueva.categorias.get('a'))?.color).toBe('#707070');expect((await nueva.categorias.get('b'))?.color).toBe('#123456');await nueva.delete();
});
