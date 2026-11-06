import type { Movimiento } from '../db/types';

export function partesMovimiento(m:Pick<Movimiento,'reparto'|'categoriaId'|'importe'>) {
  return m.reparto?.length ? m.reparto : [{categoriaId:m.categoriaId,importe:m.importe}];
}

/** Refunds reduce spending on the actual refund date, without becoming income. */
export function desglosarGastos(movimientos:Movimiento[]) {
  return movimientos.filter(m=>m.tipo==='gasto'||m.devolucionDe).flatMap(m=>
    partesMovimiento(m).map(p=>({...m,categoriaId:p.categoriaId,importe:p.importe*(m.devolucionDe?-1:1)})));
}

export function validarReparto(m:Pick<Movimiento,'reparto'|'categoriaId'|'importe'|'tipo'>) {
  if(m.reparto===undefined)return null;
  if(!Array.isArray(m.reparto)||m.reparto.length<2||m.tipo==='transferencia')return 'El reparto necesita al menos dos categorías.';
  const ids=new Set<string>();let total=0;
  for(const p of m.reparto){
    if(!p||typeof p.categoriaId!=='string'||!p.categoriaId||ids.has(p.categoriaId)||!Number.isSafeInteger(p.importe)||p.importe<=0)return 'Elige categorías distintas e importes positivos para el reparto.';
    ids.add(p.categoriaId);total+=p.importe;
  }
  return total===m.importe&&Number.isSafeInteger(total)?null:'El reparto debe sumar exactamente el importe del movimiento.';
}
