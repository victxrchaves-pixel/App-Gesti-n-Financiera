import {db,type NetoDB} from './db';
import {crearMovimiento} from './repo';
import {prepararCSV,type ColumnasCSV} from '../lib/csv';
export async function importarCSV(datos:{filas:string[][];columnas:ColumnasCSV;cuentaId:string;seleccion:{linea:number;categoriaId:string;permitirDuplicado:boolean}[];conservarSaldo:boolean;loteId:string},d:NetoDB=db) {
  if(!datos.loteId||new Set([datos.columnas.fecha,datos.columnas.nota,datos.columnas.importe]).size!==3)throw new Error('Elige columnas distintas para fecha, concepto e importe.');
  return d.transaction('rw',d.movimientos,d.cuentas,d.categorias,async()=>{
    const cuenta=await d.cuentas.get(datos.cuentaId);if(!cuenta||cuenta.eliminada||cuenta.archivada||cuenta.cuentaPadreId||cuenta.ahorroGeneral||cuenta.ambito!=='personal')throw new Error('Elige una cuenta personal de uso disponible.');
    const filas=prepararCSV(datos.filas,datos.columnas,cuenta.id,await d.movimientos.toArray());let guardados=0,omitidos=0,neto=0;
    for(const seleccion of datos.seleccion){
      const fila=filas.find(f=>f.linea===seleccion.linea);if(!fila||fila.error)throw new Error('Revisa las filas seleccionadas antes de importar.');
      if(fila.duplicado&&!seleccion.permitirDuplicado){omitidos++;continue}
      const operacionId=`csv:${datos.loteId}:${fila.linea}`;if(await d.movimientos.where('operacionId').equals(operacionId).count()){omitidos++;continue}
      if((await d.categorias.get(seleccion.categoriaId))?.tipo!==fila.tipo)throw new Error('Revisa las categorías de las filas seleccionadas.');
      const id=await crearMovimiento({tipo:fila.tipo,fecha:fila.fecha,importe:fila.importe,cuentaId:cuenta.id,categoriaId:seleccion.categoriaId,nota:fila.nota,origen:'importado'},d);
      await d.movimientos.update(id,{operacionId});guardados++;neto+=fila.importe*(fila.tipo==='gasto'?-1:1);if(!Number.isSafeInteger(neto))throw new Error('El total del extracto supera el importe permitido.');
    }
    if(datos.conservarSaldo){const saldoInicial=cuenta.saldoInicial-neto;if(!Number.isSafeInteger(saldoInicial))throw new Error('El saldo resultante supera el importe permitido.');await d.cuentas.update(cuenta.id,{saldoInicial})}
    return {guardados,omitidos};
  });
}
