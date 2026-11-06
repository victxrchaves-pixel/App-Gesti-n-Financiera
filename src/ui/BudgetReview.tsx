import {useState} from 'react';
import {db} from '../db/db';
import {usePlanMes,usePresupuestos,useMovimientos,useCuentas,useCategorias} from '../db/hooks';
import {addMonths,monthKey,monthLabel,todayISO} from '../lib/dates';
import {gastosPresupuesto,resumenPresupuestos} from '../lib/budgets';
import {formatMoney} from '../lib/money';
import {Modal,useToast} from './Modal';
import {Icon} from './Icon';

export function BudgetReview({mes=monthKey(todayISO())}:{mes?:string}) {
  const plan=usePlanMes(mes),[abierto,setAbierto]=useState(false),[busy,setBusy]=useState(false),avisar=useToast();
  const anterior=plan?.repetidoDe??addMonths(mes,-1),previos=usePresupuestos(anterior),actuales=usePresupuestos(mes),cuentas=useCuentas(),movimientos=useMovimientos(),cats=useCategorias();
  const resumen=resumenPresupuestos(previos,gastosPresupuesto(movimientos,cuentas,anterior,todayISO()));
  if(!plan?.repetidoDe||plan.revisado||mes>monthKey(todayISO()))return null;
  return <><section className="budget-review-notice" aria-label="Revisión del presupuesto"><span className="reminder-symbol"><Icon name="presupuestos"/></span><div><strong>Tu presupuesto ya continúa este mes</strong><p>Hemos mantenido tus límites. Puedes revisar {monthLabel(anterior,false)} y ajustar lo que necesites.</p></div><button className="btn btn-secondary" onClick={()=>setAbierto(true)}>Revisar el mes</button></section>
    {abierto&&<Modal titulo={`Revisión de ${monthLabel(anterior)}`} onClose={()=>setAbierto(false)} amplio><div className="modal-body"><p>Los límites se repiten automáticamente. Esta revisión es un aviso; no registra gastos ni transfiere lo que sobre a tus metas.</p><div className="review-totals"><div><span>Presupuestado</span><strong>{formatMoney(resumen.limite)}</strong></div><div><span>Gastado realmente</span><strong>{formatMoney(resumen.gastado)}</strong></div><div><span>{resumen.restante<0?'Por encima del plan':'Margen del plan'}</span><strong>{formatMoney(Math.abs(resumen.restante))}</strong></div></div><dl className="finance-breakdown">{resumen.filas.map(p=><div key={p.id}><dt>{cats.find(c=>c.id===p.categoriaId)?.nombre??'Categoría'}<small>Gastado {formatMoney(p.gastado)} · límite {formatMoney(p.limite)}</small></dt><dd>{formatMoney(actuales.find(a=>a.categoriaId===p.categoriaId)?.limite??0)}<small>Límite actual</small></dd></div>)}</dl><p className="field-hint">Los gastos sin presupuesto del mes fueron {formatMoney(resumen.sinPresupuesto)}. Los movimientos de ahorro son transferencias, no gastos.</p><div className="modal-footer"><a className="btn btn-secondary" href="#/presupuestos" onClick={()=>setAbierto(false)}>Ajustar presupuestos</a><button className="btn btn-primary" disabled={busy} onClick={async()=>{setBusy(true);try{await db.planesMes.update(mes,{revisado:true});setAbierto(false);avisar('Revisión completada. Tu presupuesto sigue activo.')}catch{avisar('No se pudo guardar la revisión.')}finally{setBusy(false)}}}>Mantener y terminar revisión</button></div></div></Modal>}
  </>;
}
