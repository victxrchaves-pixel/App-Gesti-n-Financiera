import type { AporteMeta,Cuenta,Meta,Movimiento } from '../db/types';
import { saldosPorCuenta } from './balances';
import { todayISO } from './dates';
export function dineroMeta(meta:Meta,aportes:AporteMeta[],cuentas:Cuenta[],movimientos:Movimiento[]) {
 const reales=movimientos.filter(m=>m.fecha<=todayISO());const mapa=new Map(reales.map(m=>[m.id,m]));
 const filas=aportes.filter(a=>a.metaId===meta.id&&a.origen!=='plan'&&(a.fecha??mapa.get(a.movimientoId??'')?.fecha??`${a.mes}-01`)<=todayISO());
 const aportado=meta.inicial+filas.reduce((s,a)=>s+a.importe,0);
 const gastado=reales.filter(m=>m.tipo==='gasto'&&(m.cuentaId===meta.cuentaAhorroId||m.metaId===meta.id)).reduce((s,m)=>s+m.importe,0);
 const retirado=reales.filter(m=>m.tipo==='transferencia'&&m.cuentaId===meta.cuentaAhorroId).reduce((s,m)=>s+m.importe,0);
 const cuenta=cuentas.find(c=>c.id===meta.cuentaAhorroId&&!c.eliminada&&!c.archivada);
 const disponible=meta.cuentaAhorroId?(cuenta?saldosPorCuenta(cuentas,reales).get(cuenta.id)??0:0):aportado-gastado-retirado;
 const financiado=Math.max(0,aportado-retirado);
 return {aportado,gastado,retirado,disponible,financiado,progreso:meta.categoriaAhorro==='viajes'?financiado:disponible};
}
