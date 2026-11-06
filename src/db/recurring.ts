import { db, type NetoDB } from './db';
import type { PagoFijo } from './types';
import { newId } from '../lib/id';
import { isISODate, todayISO } from '../lib/dates';
import { siguienteRenovacion } from '../lib/subscriptions';
import { crearMovimiento } from './repo';
export function validarPagoFijo(p:Omit<PagoFijo,'id'>) {
  if(typeof p.nombre!=='string'||!p.nombre.trim()||p.nombre.length>80)return 'Escribe un nombre de hasta 80 caracteres.';
  if(!['gasto','ingreso'].includes(p.tipo)||!Number.isSafeInteger(p.importe)||p.importe<=0)return 'Revisa el tipo y el importe de la cuota.';
  if(!['mensual','trimestral','anual'].includes(p.periodo)||!isISODate(p.proximaFecha)||!Number.isInteger(p.diaCobro)||p.diaCobro<1||p.diaCobro>31)return 'Revisa la periodicidad y la fecha de referencia.';
  if(typeof p.cuentaId!=='string'||!p.cuentaId||typeof p.categoriaId!=='string'||!p.categoriaId||typeof p.activo!=='boolean'||typeof p.nota!=='string')return 'Elige cuenta y categoría.';
  return null;
}
export async function guardarPagoFijo(datos:Omit<PagoFijo,'id'>,id?:string,d:NetoDB=db) {
  const error=validarPagoFijo(datos);if(error)throw new Error(error);
  await d.transaction('rw',d.pagosFijos,d.cuentas,d.categorias,async()=>{
    const cuenta=await d.cuentas.get(datos.cuentaId);const cat=await d.categorias.get(datos.categoriaId);
    if(!cuenta||cuenta.eliminada||cuenta.archivada||cuenta.ambito!=='personal'||cat?.tipo!==datos.tipo)throw new Error('Elige una cuenta personal disponible y una categoría del tipo correcto.');
    if(id&&!await d.pagosFijos.get(id))throw new Error('El recurrente ya no existe.');
    await d.pagosFijos.put({...(id?await d.pagosFijos.get(id):{}),...datos,nombre:datos.nombre.trim(),id:id??newId()});
  });
}
export async function registrarPago(datos:{origen:'fijo'|'suscripcion';recurrenteId:string;periodoFecha:string;fecha:string;importe:number;cuentaId:string;categoriaId:string},d:NetoDB=db) {
  if(!isISODate(datos.fecha)||datos.fecha>todayISO()||!Number.isSafeInteger(datos.importe)||datos.importe<=0)throw new Error('Registra el importe y la fecha de un pago o ingreso ya realizado, hasta hoy.');
  return d.transaction('rw',[d.pagosRegistrados,d.pagosFijos,d.suscripciones,d.movimientos,d.cuentas,d.categorias],async()=>{
    const existente=await d.pagosRegistrados.where('[origen+recurrenteId+periodoFecha]').equals([datos.origen,datos.recurrenteId,datos.periodoFecha]).first();
    if(existente&&await d.movimientos.get(existente.movimientoId))return existente.movimientoId;
    if(existente)await d.pagosRegistrados.delete(existente.id);
    const fijo=datos.origen==='fijo'?await d.pagosFijos.get(datos.recurrenteId):undefined;
    const sub=datos.origen==='suscripcion'?await d.suscripciones.get(datos.recurrenteId):undefined;
    const item=fijo??sub;if(!item||item.proximaFecha!==datos.periodoFecha)throw new Error('La ficha cambió o este periodo ya se registró. Actualiza la pantalla.');
    if((fijo&&!fijo.activo)||(sub&&sub.estado!=='activa'))throw new Error('El recurrente no está activo.');
    const tipo=fijo?.tipo??'gasto';const cuenta=await d.cuentas.get(datos.cuentaId);const cat=await d.categorias.get(datos.categoriaId);
    if(!cuenta||cuenta.eliminada||cuenta.archivada||cuenta.ambito!==(sub?.ambito??'personal')||cat?.tipo!==tipo)throw new Error('Revisa la cuenta y la categoría.');
    const movimientoId=await crearMovimiento({tipo,fecha:datos.fecha,importe:datos.importe,cuentaId:datos.cuentaId,categoriaId:datos.categoriaId,nota:item.nombre,origen:'recurrente'},d);
    await d.pagosRegistrados.add({id:newId(),origen:datos.origen,recurrenteId:datos.recurrenteId,periodoFecha:datos.periodoFecha,fecha:datos.fecha,importe:datos.importe,movimientoId});
    let proximaFecha=siguienteRenovacion(item);
    // Undoing an older payment must not ask again for later periods already confirmed.
    while(true){
      const pago=await d.pagosRegistrados.where('[origen+recurrenteId+periodoFecha]').equals([datos.origen,item.id,proximaFecha]).first();
      if(!item.periodosOmitidos?.includes(proximaFecha)&&(!pago||!await d.movimientos.get(pago.movimientoId)))break;
      proximaFecha=siguienteRenovacion({...item,proximaFecha});
    }
    if(fijo)await d.pagosFijos.update(fijo.id,{proximaFecha,cuentaId:datos.cuentaId,categoriaId:datos.categoriaId});else await d.suscripciones.update(sub!.id,{proximaFecha});
    return movimientoId;
  });
}

export async function omitirPeriodo(origen:'fijo'|'suscripcion',id:string,periodo:string,d:NetoDB=db) {
  return d.transaction('rw',d.pagosFijos,d.suscripciones,d.pagosRegistrados,d.movimientos,async()=>{
    const tabla=origen==='fijo'?d.pagosFijos:d.suscripciones;const item=await tabla.get(id);
    if(item?.periodosOmitidos?.includes(periodo))return;
    if(!item||item.proximaFecha!==periodo)throw new Error('La ficha cambió. Actualiza la pantalla.');
    if(('activo' in item&&!item.activo)||('estado' in item&&item.estado!=='activa'))throw new Error('El recurrente no está activo.');
    const periodosOmitidos=[...(item.periodosOmitidos??[]),periodo];let proximaFecha=siguienteRenovacion(item);
    while(true){const pago=await d.pagosRegistrados.where('[origen+recurrenteId+periodoFecha]').equals([origen,id,proximaFecha]).first();if(!periodosOmitidos.includes(proximaFecha)&&(!pago||!await d.movimientos.get(pago.movimientoId)))break;proximaFecha=siguienteRenovacion({...item,proximaFecha})}
    await tabla.update(id,{proximaFecha,periodosOmitidos});
  });
}

export async function deshacerPago(id:string,d:NetoDB=db) {
  return d.transaction('rw',d.pagosRegistrados,d.movimientos,d.pagosFijos,d.suscripciones,async()=>{
    const pago=await d.pagosRegistrados.get(id);if(!pago)return;
    if(await d.movimientos.filter(m=>m.devolucionDe===pago.movimientoId).count())throw new Error('Anula primero la devolución de este pago.');
    await d.movimientos.delete(pago.movimientoId);await d.pagosRegistrados.delete(id);
    const tabla=pago.origen==='fijo'?d.pagosFijos:d.suscripciones;const item=await tabla.get(pago.recurrenteId);
    if(item&&item.proximaFecha>pago.periodoFecha)await tabla.update(item.id,{proximaFecha:pago.periodoFecha});
  });
}
