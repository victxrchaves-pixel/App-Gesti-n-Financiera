import {db,type NetoDB} from './db';
import {crearMovimiento} from './repo';
import {partesMovimiento} from '../lib/movements';

export async function registrarDevolucion(datos:{gastoId:string;importe:number;fecha:string;cuentaId:string;operacionId:string},d:NetoDB=db) {
  return d.transaction('rw',d.movimientos,d.cuentas,d.categorias,async()=>{
    const repetida=await d.movimientos.where('operacionId').equals(datos.operacionId).first();if(repetida)return repetida.id;
    const original=await d.movimientos.get(datos.gastoId),cuenta=await d.cuentas.get(datos.cuentaId);
    if(!original||original.tipo!=='gasto')throw new Error('El gasto original ya no existe.');
    if(!cuenta||cuenta.eliminada||cuenta.archivada||cuenta.ambito!==(await d.cuentas.get(original.cuentaId))?.ambito)throw new Error('Elige una cuenta disponible del mismo ámbito.');
    if(datos.fecha<original.fecha)throw new Error('La devolución no puede ser anterior al gasto.');
    const devueltos=await d.movimientos.filter(m=>m.devolucionDe===original.id).toArray();
    const restantes=partesMovimiento(original).map(p=>({...p,importe:p.importe-devueltos.reduce((s,m)=>s+partesMovimiento(m).filter(x=>x.categoriaId===p.categoriaId).reduce((s,x)=>s+x.importe,0),0)})).filter(p=>p.importe>0);
    const pendiente=restantes.reduce((s,p)=>s+p.importe,0);
    if(!Number.isSafeInteger(datos.importe)||datos.importe<=0||datos.importe>pendiente)throw new Error('La devolución supera lo que queda por devolver de este gasto.');
    const partes=restantes.map(p=>{const producto=BigInt(datos.importe)*BigInt(p.importe);return {categoriaId:p.categoriaId!,importe:Number(producto/BigInt(pendiente)),fraccion:producto%BigInt(pendiente)}});
    let resto=datos.importe-partes.reduce((s,p)=>s+p.importe,0);
    for(const parte of [...partes].sort((a,b)=>a.fraccion>b.fraccion?-1:a.fraccion<b.fraccion?1:0)){if(!resto)break;parte.importe++;resto--}
    const reparto=partes.filter(p=>p.importe>0).map(({categoriaId,importe})=>({categoriaId,importe}));
    const id=await crearMovimiento({tipo:'ingreso',fecha:datos.fecha,importe:datos.importe,cuentaId:datos.cuentaId,categoriaId:reparto[0].categoriaId,nota:`Devolución · ${original.nota||'Gasto'}`},d);
    await d.movimientos.update(id,{metaId:original.metaId,partidaViajeId:original.partidaViajeId,devolucionDe:original.id,operacionId:datos.operacionId,reparto:reparto.length>1?reparto:undefined});return id;
  });
}
