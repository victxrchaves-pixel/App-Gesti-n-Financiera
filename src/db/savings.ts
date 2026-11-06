import type { NetoDB } from './db';
import { newId } from '../lib/id';

/** One visible savings account; goals keep their own internal ledger pockets. */
export async function agruparAhorro(d:Pick<NetoDB,'cuentas'|'metas'>,crearSiVacio=false) {
  const cuentas=await d.cuentas.toArray();
  const ahorro=cuentas.filter(c=>c.ambito==='personal'&&c.tipo==='ahorro'&&!c.eliminada&&!c.archivada);
  if(!ahorro.length&&!crearSiVacio)return undefined;
  const metas=await d.metas.toArray();
  const vinculadas=new Set(metas.map(m=>m.cuentaAhorroId));
  let general=ahorro.find(c=>c.ahorroGeneral&&!c.cuentaPadreId)
    ??ahorro.find(c=>!vinculadas.has(c.id)&&c.nombre.trim().toLocaleLowerCase()==='ahorro')
    ??ahorro.find(c=>!vinculadas.has(c.id)&&!c.cuentaPadreId);
  if(!general){
    general={id:newId(),nombre:'Ahorro',tipo:'ahorro',ambito:'personal',saldoInicial:0,archivada:false,ahorroGeneral:true,orden:cuentas.length,creadaEn:new Date().toISOString()};
    await d.cuentas.add(general);
  }else if(!general.ahorroGeneral||general.cuentaPadreId){
    await d.cuentas.update(general.id,{ahorroGeneral:true,cuentaPadreId:undefined,bolsilloMetaId:undefined});
  }
  for(const c of ahorro){
    if(c.id===general.id)continue;
    const meta=metas.find(m=>m.cuentaAhorroId===c.id);
    if(c.cuentaPadreId!==general.id||c.ahorroGeneral||(meta&&c.bolsilloMetaId!==meta.id))
      await d.cuentas.update(c.id,{cuentaPadreId:general.id,ahorroGeneral:false,...(meta?{bolsilloMetaId:meta.id}:{})});
  }
  return general.id;
}

export async function crearBolsilloMeta(metaId:string,nombre:string,d:NetoDB) {
  const padre=await agruparAhorro(d,true);
  const id=newId();
  await d.cuentas.add({id,nombre:`Meta · ${nombre.trim()}`,tipo:'ahorro',ambito:'personal',saldoInicial:0,archivada:false,cuentaPadreId:padre,bolsilloMetaId:metaId,orden:await d.cuentas.count(),creadaEn:new Date().toISOString()});
  return id;
}
