import {useState} from 'react';
import type {Movimiento} from '../db/types';
import {useCuentas,useMovimientos} from '../db/hooks';
import {registrarDevolucion} from '../db/movementActions';
import {todayISO} from '../lib/dates';
import {formatMoney} from '../lib/money';
import {newId} from '../lib/id';
import {AmountInput,useAmountField} from './AmountInput';
import {Modal,useToast} from './Modal';
export function RegistrarDevolucion({gasto,cerrar}:{gasto:Movimiento;cerrar:()=>void}) {
  const todas=useCuentas(),movimientos=useMovimientos(),importe=useAmountField(),avisar=useToast();
  const cuentaOriginal=todas.find(c=>c.id===gasto.cuentaId),cuentas=todas.filter(c=>!c.eliminada&&!c.archivada&&c.ambito===cuentaOriginal?.ambito&&(!c.cuentaPadreId&&!c.ahorroGeneral||c.id===gasto.cuentaId));
  const [cuentaId,setCuentaId]=useState(cuentas.find(c=>c.id===gasto.cuentaId)?.id??cuentas[0]?.id??''),[fecha,setFecha]=useState(todayISO()),[error,setError]=useState(''),[busy,setBusy]=useState(false),[operacionId]=useState(newId);
  const cuentaActual=cuentas.some(c=>c.id===cuentaId)?cuentaId:cuentas.find(c=>c.id===gasto.cuentaId)?.id??cuentas[0]?.id??'';
  const devuelto=movimientos.filter(m=>m.devolucionDe===gasto.id).reduce((s,m)=>s+m.importe,0);
  return <Modal titulo="Registrar devolución" onClose={cerrar}><form className="modal-body" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{await registrarDevolucion({gastoId:gasto.id,importe:importe.cents??0,fecha,cuentaId:cuentaActual,operacionId});avisar('Devolución registrada y gasto ajustado');cerrar()}catch(e){setError(e instanceof Error?e.message:'No se pudo registrar.')}finally{setBusy(false)}}}>
    <p>{gasto.nota||'Gasto original'} · {formatMoney(gasto.importe)}. Pendiente de devolver: <strong>{formatMoney(gasto.importe-devuelto)}</strong>.</p><p className="field-hint">Registra solo dinero ya devuelto. Reducirá los gastos de las categorías originales en la fecha de devolución; no contará como un nuevo ingreso.</p>
    <div className="field"><label className="field-label" htmlFor="refund-amount">Importe devuelto</label><AmountInput id="refund-amount" texto={importe.texto} onChange={importe.setTexto}/></div>
    <div className="field-row"><div className="field"><label className="field-label" htmlFor="refund-date">Fecha de devolución</label><input className="input" id="refund-date" type="date" min={gasto.fecha} max={todayISO()} value={fecha} onChange={e=>setFecha(e.target.value)} required/></div><div className="field"><label className="field-label" htmlFor="refund-account">Dónde has recibido el dinero</label><select className="select" id="refund-account" value={cuentaActual} onChange={e=>setCuentaId(e.target.value)}>{cuentas.map(c=><option key={c.id} value={c.id}>{c.cuentaPadreId?`Meta: ${c.nombre.replace(/^(Meta|Ahorro) · /,'')}`:c.nombre}</option>)}</select></div></div>
    {error&&<p role="alert" className="form-error">{error}</p>}<div className="modal-footer"><button className="btn btn-ghost" type="button" onClick={cerrar}>Cancelar</button><button className="btn btn-primary" disabled={busy||!cuentas.length}>Confirmar devolución</button></div>
  </form></Modal>;
}
