import { dineroMeta } from '../lib/goalMoney';
import { GoalActions } from './GoalActions';
import { newId } from '../lib/id';
import { COLORES_UX } from '../lib/colors';
import { TripBreakdown } from './TripBreakdown';
import { saldosPorCuenta } from '../lib/balances';
import { parseDecimal } from '../lib/investments';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAportesMetas, useMetas, useCuentas, useMovimientos } from '../db/hooks';
import { borrarMeta, aportarMeta, guardarMeta, sincronizarMetas } from '../db/goals';
import type { Meta, Cuenta, Movimiento, AporteMeta } from '../db/types';
import { todayISO, monthKey, monthLabel, addMonths } from '../lib/dates';
import { centsToInput, formatMoney } from '../lib/money';
import { Modal, useConfirm, useToast } from './Modal';
import { AmountInput, useAmountField } from './AmountInput';
import { ColorPicker } from './ColorPicker';
import { Progress } from './Progress';
import { Icon } from './Icon';

const PROPUESTAS = [{ nombre:'Viajes', objetivo:150000, mensual:10000, icono:'viaje' }, { nombre:'Ahorro general', objetivo:300000, mensual:10000, icono:'ahorro' }, { nombre:'Fondo de emergencia', objetivo:300000, mensual:15000, icono:'escudo' }];
function FormMeta({ actual, sugerida, mes, cerrar }: { actual?: Meta; sugerida?: typeof PROPUESTAS[number]; mes: string; cerrar: () => void }) {
  const cuentas = useCuentas().filter(c => c.ambito === 'personal' && !c.eliminada && !c.archivada && c.id !== actual?.cuentaAhorroId);
  const [cuentaOrigenId,setCuentaOrigenId] = useState(actual?.cuentaOrigenId ?? cuentas.find(c=>c.tipo==='banco')?.id ?? '');
  const [origenEditado,setOrigenEditado] = useState(false);
  useEffect(()=>{if(!actual&&!origenEditado&&cuentas.some(c=>c.tipo==='banco'))setCuentaOrigenId(cuentas.find(c=>c.tipo==='banco')!.id)},[cuentas,actual,origenEditado]);
  const [categoriaAhorro,setCategoriaAhorro] = useState(actual?.categoriaAhorro ?? (sugerida?.nombre === 'Viajes' ? 'viajes' : 'ahorro'));
  const [modoImporte,setModoImporte] = useState(actual?.porcentaje != null ? 'porcentaje' : 'fijo');
  const [porcentaje,setPorcentaje] = useState(String(actual?.porcentaje ?? 10));
  const referencia = useAmountField(actual?.baseMensual ?? 200000);
  const [nombre, setNombre] = useState(actual?.nombre ?? sugerida?.nombre ?? '');
  const objetivo = useAmountField(actual?.objetivo ?? sugerida?.objetivo); const inicial = useAmountField(actual?.inicial ?? 0); const mensual = useAmountField(actual?.mensual ?? sugerida?.mensual ?? 10000);
  const [desde, setDesde] = useState(actual?.mesInicio ?? mes); const [automatica, setAutomatica] = useState(actual?.automatica ?? true); const [activa, setActiva] = useState(actual?.activa ?? true);
  const [color, setColor] = useState<string | null>(actual?.color ?? null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const confirmar = useConfirm();
  return <Modal titulo={actual ? 'Editar meta' : 'Crear meta de ahorro'} onClose={cerrar}><form className="modal-body" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { if ([objetivo.cents, inicial.cents, mensual.cents].some(v => v === null)) throw new Error('Revisa los importes.'); if (modoImporte==='porcentaje' && (parseDecimal(porcentaje)===null || referencia.cents===null)) throw new Error('Revisa el porcentaje y el ingreso mensual.'); await guardarMeta({ cuentaOrigenId:cuentaOrigenId || null, categoriaAhorro, porcentaje:modoImporte==='porcentaje'?parseDecimal(porcentaje):null, baseMensual:modoImporte==='porcentaje'?referencia.cents:null, nombre, objetivo:objetivo.cents!, inicial:inicial.cents!, mensual:mensual.cents!, mesInicio:desde, automatica, activa, color }, actual?.id); cerrar(); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }}>
    <div className="field"><label className="field-label" htmlFor="goal-name">Nombre de la meta</label><input className="input" id="goal-name" value={nombre} onChange={e => setNombre(e.target.value)} required maxLength={80} data-autofocus /></div>
    <div className="field"><label className="field-label" htmlFor="goal-origin">Desde qué cuenta reservar</label><select className="select" id="goal-origin" value={cuentaOrigenId} onChange={e=>{setOrigenEditado(true);setCuentaOrigenId(e.target.value)}}><option value="">Solo seguimiento · sin mover dinero</option>{cuentas.map(c=><option value={c.id} key={c.id}>{c.nombre}</option>)}</select><span className="field-hint">Neto creará una cuenta de ahorro para esta meta y registrará transferencias internas. No envía órdenes a tu banco.</span></div>
    <div className="field"><label className="field-label" htmlFor="goal-kind">Tipo de ahorro</label><select id="goal-kind" className="select" value={categoriaAhorro} onChange={e=>setCategoriaAhorro(e.target.value)}><option value="ahorro">Ahorro general</option><option value="viajes">Ahorro de viajes</option><option value="otros">Otro destino</option></select></div>
    <div className="field"><label className="field-label" htmlFor="goal-amount-mode">Cómo repartir</label><select id="goal-amount-mode" className="select" value={modoImporte} onChange={e=>setModoImporte(e.target.value)}><option value="fijo">Un importe fijo cada mes</option><option value="porcentaje">Un porcentaje de mi ingreso mensual de referencia</option></select></div>
    {modoImporte==='porcentaje'&&<div className="field-row"><div className="field"><label className="field-label" htmlFor="goal-reference">Ingreso mensual de referencia</label><AmountInput id="goal-reference" texto={referencia.texto} onChange={referencia.setTexto}/></div><div className="field"><label className="field-label" htmlFor="goal-percent">Porcentaje para esta meta</label><input className="input" id="goal-percent" inputMode="decimal" value={porcentaje} onChange={e=>setPorcentaje(e.target.value)}/><span className="field-hint">Resultado: {formatMoney(Math.round((referencia.cents??0)*(parseDecimal(porcentaje)??0)/100))}/mes. El ingreso de referencia lo defines tú.</span></div></div>}
    <div className="field-row"><div className="field"><label className="field-label" htmlFor="goal-target">Quiero reunir</label><AmountInput id="goal-target" texto={objetivo.texto} onChange={objetivo.setTexto} /></div><div className="field"><label className="field-label" htmlFor="goal-monthly">Destinar cada mes</label>{modoImporte==='fijo'?<AmountInput id="goal-monthly" texto={mensual.texto} onChange={mensual.setTexto} />:<output id="goal-monthly" className="input">{formatMoney(Math.round((referencia.cents??0)*(parseDecimal(porcentaje)??0)/100))}</output>}</div></div>
    <div className="field-row"><div className="field"><label className="field-label" htmlFor="goal-initial">Ahorro previo (solo seguimiento)</label><AmountInput id="goal-initial" texto={inicial.texto} onChange={inicial.setTexto} /><span className="field-hint">Lo ahorrado antes de estas reservas. No crea saldo adicional en tus cuentas.</span></div><div className="field"><label className="field-label" htmlFor="goal-start">Desde qué mes</label><input id="goal-start" className="input" type="month" min="2000-01" max="9999-12" value={desde} onChange={e => setDesde(e.target.value)} required /></div></div>
    <div className="field"><label className="field-label" htmlFor="goal-mode">Cómo se llena la meta</label><select id="goal-mode" className="select" value={automatica ? 'plan' : 'manual'} onChange={e => setAutomatica(e.target.value === 'plan')}><option value="plan">Reservar solo la cuota del mes actual</option><option value="manual">Solo cuando confirme una aportación</option></select></div>
    <p className="finance-notice">{cuentaOrigenId ? 'Las reservas se reflejan como transferencias desde tu cuenta de origen hacia la cuenta de ahorro de esta meta. Solo se reserva la cuota del mes actual, al abrir Neto y si hay saldo. Los atrasos se recuperan cuando tú lo confirmes. ' : 'Sin cuenta de origen, solo puedes anotar ahorro que ya has realizado; no modifica el disponible de tus cuentas. '}{automatica ? 'Los meses pendientes no se cobran automáticamente.' : 'Solo se registran al confirmar una aportación.'} Cambiar la cuota afecta a los meses aún no registrados.</p>
    {actual && <label className="goal-check"><input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} />Mantener activa la asignación mensual</label>}
    <ColorPicker etiqueta="Color de la meta" valor={color ?? (categoriaAhorro==='viajes' ? COLORES_UX.inversion : COLORES_UX.ingreso)} onChange={setColor} restablecer={() => setColor(null)} />
    {error && <div role="alert" className="form-error">{error}</div>}
    <div className="modal-footer">{actual && <button type="button" className="btn btn-ghost left" disabled={busy} onClick={async () => { if (await confirmar({ titulo:'Eliminar meta', mensaje:'Se eliminará la meta y sus asignaciones de ahorro. Tus cuentas y movimientos se conservarán.', confirmar:'Eliminar', peligro:true })) { try { await borrarMeta(actual.id); cerrar(); } catch { setError('No se pudo eliminar.'); } } }}>Eliminar</button>}<button type="button" className="btn btn-ghost" onClick={cerrar}>Cancelar</button><button className="btn btn-primary" disabled={busy}>Guardar meta</button></div>
  </form></Modal>;
}
function FormAporte({ meta, mes, importe, cerrar }: { meta:Meta; mes:string; importe:number; cerrar:()=>void }) {
 const cantidad=useAmountField(importe);const[inicio,setInicio]=useState(mes);const[numero,setNumero]=useState(1);const[fecha,setFecha]=useState(todayISO());const[grupoId]=useState(newId);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const aportes=useAportesMetas().filter(a=>a.metaId===meta.id&&a.origen!=='plan');
 const meses=Array.from({length:numero},(_,i)=>addMonths(inicio,i));const base=Math.floor((cantidad.cents??0)/numero);const resto=(cantidad.cents??0)%numero;
 return <Modal titulo={`Aportar y repartir · ${meta.nombre}`} onClose={cerrar}><form className="modal-body" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{await aportarMeta(meta.id,cantidad.cents??0,meses,fecha,grupoId);cerrar()}catch(e){setError(e instanceof Error?e.message:'No se pudo registrar.')}finally{setBusy(false)}}}>
 <p>Registra el dinero que aportas ahora. Puedes atribuirlo a varios meses, por ejemplo 300 € repartidos en tres cuotas de 100 €.</p><div className="field"><label className="field-label" htmlFor="goal-contribution">Importe total aportado ahora</label><AmountInput id="goal-contribution" texto={cantidad.texto} onChange={cantidad.setTexto}/></div><div className="field"><label className="field-label" htmlFor="goal-contribution-date">Fecha real de la aportación</label><input type="date" id="goal-contribution-date" className="input" max={todayISO()} value={fecha} onChange={e=>setFecha(e.target.value)} required/></div>
 <button type="button" className="btn btn-secondary" onClick={()=>{setInicio(addMonths(monthKey(todayISO()),-2));setNumero(3);cantidad.setTexto(centsToInput(meta.mensual*3))}}>Repartir entre los últimos tres meses</button>
 <div className="field-row"><div className="field"><label className="field-label" htmlFor="goal-share-start">Primer mes del reparto</label><input type="month" id="goal-share-start" className="input" min="2000-01" max="9999-12" value={inicio} onChange={e=>setInicio(e.target.value)} required/></div><div className="field"><label className="field-label" htmlFor="goal-share-count">Número de meses</label><select id="goal-share-count" className="select" value={numero} onChange={e=>setNumero(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></div></div>
 <ul className="contribution-split">{meses.map((m,i)=><li key={m}><span>{monthLabel(m)}<small>{formatMoney(aportes.filter(a=>a.mes===m).reduce((s,a)=>s+a.importe,0))} ya registrados</small></span><strong>+{formatMoney(base+(i<resto?1:0))}</strong></li>)}</ul><p className="field-hint">{meta.cuentaOrigenId?'Se crea una sola transferencia real por el total, con la fecha indicada.':'Se anota únicamente ahorro ya realizado, sin cambiar saldos de cuentas.'} Los meses son etiquetas de reparto; no se crean movimientos futuros ni se sustituyen aportaciones anteriores.</p>
 {error&&<div role="alert" className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={cerrar}>Cancelar</button><button className="btn btn-primary" disabled={busy}>Confirmar aportación</button></div></form></Modal>;
}
export function GoalPlans({ mes = monthKey(todayISO()), completo = false }: { mes?: string; completo?: boolean }) {
  const metas = useMetas(); const cuentas=useCuentas(); const movimientos=useMovimientos(); const saldos=saldosPorCuenta(cuentas,movimientos); const aportes = useAportesMetas(); const [form, setForm] = useState<{actual?:Meta; sugerida?:typeof PROPUESTAS[number]} | null>(null); const [aporte,setAporte]=useState<Meta|null>(null); const [elegirDestino,setElegirDestino]=useState(false); const [detalleId,setDetalleId]=useState<string|null>(null); const [principalId,setPrincipalId]=useState<string|null>(null); const avisar=useToast();
  useEffect(() => { void sincronizarMetas().catch(() => avisar('No se pudieron actualizar las asignaciones de ahorro.')); },[avisar]);
  const totalMes=metas.filter(m=>m.activa&&m.mesInicio<=mes).reduce((s,m)=>s+m.mensual,0);
  const panel=useRef<HTMLElement>(null);
  const detalle=metas.find(m=>m.id===detalleId);
  const principal=metas.find(m=>m.id===principalId)??metas[0];
  const pila=principal?[...metas.filter(m=>m.id!==principal.id),principal]:[];
  const abrir=(m:Meta)=>{setPrincipalId(m.id);setDetalleId(m.id)};
  const cerrarDetalle=()=>{
    const id=detalleId;setDetalleId(null);
    requestAnimationFrame(()=>{
      const tarjeta=[...(panel.current?.querySelectorAll<HTMLButtonElement>('[data-meta-id]')??[])].find(el=>el.dataset.metaId===id);
      tarjeta?.focus({preventScroll:true});tarjeta?.scrollIntoView({block:'nearest'});
    });
  };
  return <section ref={panel} className={`savings-panel${completo?' savings-full':' savings-deck-panel'}`}>
    <div className="savings-heading"><span className="section-symbol"><Icon name="metas" size={28}/></span><div><h2>Tu dinero para después</h2><p>Escoge una meta para ver su detalle.</p></div></div>
    {completo&&<div className="savings-overview"><div className="savings-monthly"><span>Cuota de ahorro mensual</span><strong>{formatMoney(totalMes)}</strong></div><div className="savings-monthly"><span>Disponible en tus metas</span><strong>{formatMoney(metas.reduce((s,m)=>s+dineroMeta(m,aportes,cuentas,movimientos).disponible,0))}</strong></div><div className="savings-monthly"><span>Metas activas</span><strong>{metas.filter(m=>m.activa).length}</strong></div></div>}
    {completo?<div className="goal-list goal-preview-grid">{metas.map(m=><article className="goal-preview-card" key={m.id}><GoalPreview meta={m} dinero={dineroMeta(m,aportes,cuentas,movimientos)} abrir={()=>abrir(m)}/></article>)}</div>:metas.length>0?<>
      <div className="goal-deck" role="group" aria-label="Metas de ahorro superpuestas" style={{height:210+(pila.length-1)*76}}>
        {pila.map((m,i)=><GoalPreview key={m.id} meta={m} dinero={dineroMeta(m,aportes,cuentas,movimientos)} abrir={()=>abrir(m)} pila principal={m.id===principal.id} style={{top:i*76,zIndex:i+1}}/>)}
      </div><p className="goal-deck-hint">Pulsa una tarjeta para abrirla. La última seleccionada queda completa delante.</p>
    </>:<div className="goal-deck-empty"><Icon name="metas" size={32}/><p>Crea una meta y empieza a separar tu ahorro.</p></div>}
    {completo&&<>
      {metas.length>0&&<button className="btn btn-primary" onClick={()=>setElegirDestino(true)}>Asignar ahorro a una meta existente</button>}
      <div className="goal-suggestions">{PROPUESTAS.filter(p=>!metas.some(m=>m.nombre===p.nombre)).map(p=><button className="goal-suggestion" key={p.nombre} onClick={()=>setForm({sugerida:p})}><Icon name={p.icono} size={20}/><span>{p.nombre}<small>Propuesta: {formatMoney(p.mensual)}/mes</small></span><Icon name="mas" size={16}/></button>)}</div>
    </>}
    <div className="goal-collection-actions"><button className="btn btn-secondary" onClick={()=>setForm({})}><Icon name="mas" size={16}/>{completo?'Otra meta':'Nueva meta'}</button>{!completo&&<a className="text-link" href="#/metas">Ver todas mis metas <Icon name="flecha" size={16}/></a>}</div>
    {completo&&<p className="field-hint">Estas propuestas son editables. Las transferencias de ahorro no cuentan como gasto en tus presupuestos.</p>}
    {detalle&&<Modal amplio titulo={`Meta · ${detalle.nombre}`} onClose={cerrarDetalle}><div className="modal-body goal-detail"><GoalTile meta={detalle} cuentas={cuentas} movimientos={movimientos} aportes={aportes} saldos={saldos} editar={()=>setForm({actual:detalle})} aportar={()=>setAporte(detalle)}/><div className="modal-footer"><button className="btn btn-secondary" onClick={cerrarDetalle}>Cerrar detalle</button></div></div></Modal>}
    {elegirDestino&&<Modal titulo="Escoge el destino del ahorro" onClose={()=>setElegirDestino(false)}><div className="modal-body"><p>Elige la meta que recibirá tu asignación mensual; después indica la cuenta de origen y el reparto.</p>{metas.map(m=><button className="goal-suggestion" key={m.id} onClick={()=>{setElegirDestino(false);setForm({actual:m})}}><Icon name="metas"/><span>{m.nombre}</span><Icon name="flecha"/></button>)}<div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setElegirDestino(false)}>Cerrar</button></div></div></Modal>}
    {form&&<FormMeta actual={form.actual} sugerida={form.sugerida} mes={mes} cerrar={()=>setForm(null)}/>} {aporte&&<FormAporte meta={aporte} mes={mes} importe={aporte.mensual} cerrar={()=>setAporte(null)}/>}
  </section>;
}

function GoalPreview({meta,dinero,abrir,pila=false,principal=false,style}:{meta:Meta;dinero:ReturnType<typeof dineroMeta>;abrir:()=>void;pila?:boolean;principal?:boolean;style?:CSSProperties}) {
  const viaje=meta.categoriaAhorro==='viajes'||meta.nombre.toLowerCase().includes('viaj')||!!meta.desglose?.length;
  const color=meta.color??(viaje?COLORES_UX.inversion:COLORES_UX.ingreso);
  return <button type="button" className={pila?'goal-deck-card':'goal-preview'} style={{...style,'--goal-color':color} as CSSProperties} data-meta-id={meta.id} data-principal={pila?principal:undefined} aria-haspopup="dialog" title={meta.nombre} aria-label={`Ver meta ${meta.nombre}`} onClick={abrir}>
    <span className="goal-preview-heading"><span className="goal-mark" style={{color}}><Icon name={viaje?'viaje':'ahorro'} size={22}/></span><span className="goal-preview-name">{meta.nombre}</span><Icon name="derecha" size={18}/></span>
    <span className="goal-preview-amount"><span>Disponible</span><strong>{formatMoney(dinero.disponible)}</strong></span>
    {!pila&&<span className="goal-preview-progress"><span>Objetivo {formatMoney(meta.objetivo)}</span><span className="goal-preview-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,dinero.progreso/meta.objetivo*100))}%`}}/></span><span className="goal-preview-link">Ver detalle <Icon name="flecha" size={15}/></span></span>}
  </button>;
}

function GoalTile({meta:m,cuentas,movimientos,aportes,saldos,editar,aportar}:{meta:Meta;cuentas:Cuenta[];movimientos:Movimiento[];aportes:AporteMeta[];saldos:Map<string,number>;editar:()=>void;aportar:()=>void}) {
  const dinero=dineroMeta(m,aportes,cuentas,movimientos);
  const viaje=m.categoriaAhorro==='viajes'||m.nombre.toLowerCase().includes('viaj')||!!m.desglose?.length;
  const color=m.color??(viaje?COLORES_UX.inversion:COLORES_UX.ingreso);
  const acciones=<><div className="goal-footer"><span>{formatMoney(m.mensual)} / mes</span><button className="btn btn-secondary" onClick={aportar}><Icon name="mas" size={16}/>Aportar / recuperar meses</button></div><GoalActions meta={m} disponible={dinero.disponible}/></>;
  return <article className="goal-tile">
    <div className="goal-main">
      <div className="goal-top"><span className="goal-mark" style={{color}}><Icon name={viaje?'viaje':'ahorro'} size={23}/></span><h3>{m.nombre}<small className="goal-kind">{viaje?'Viajes':m.categoriaAhorro==='otros'?'Otro destino':'Ahorro general'}{!m.activa?' · Pausada':''}</small></h3><button className="btn btn-ghost btn-icon" onClick={editar} aria-label={`Editar meta ${m.nombre}`}><Icon name="editar" size={18}/></button></div>
      {m.cuentaOrigenId&&<p className="goal-route">{cuentas.find(c=>c.id===m.cuentaOrigenId)?.nombre??'Cuenta de origen'} <Icon name="flecha" size={14}/> {cuentas.find(c=>c.id===m.cuentaAhorroId)?.nombre??m.nombre}</p>}
      <div className="goal-totals"><span>Disponible en esta meta</span><strong>{formatMoney(dinero.disponible)}</strong></div>
      <div className="goal-progress-caption"><span>{Math.round(dinero.progreso/m.objetivo*100)} % {viaje?'financiado':'conseguido'}</span><span>Objetivo {formatMoney(m.objetivo)}</span></div>
      <Progress valor={dinero.progreso} total={m.objetivo} etiqueta={`Progreso de ${m.nombre}`} color={color}/>
      <div className="goal-money-details"><span>Acumulado <b>{formatMoney(dinero.aportado)}</b></span><span>Gastado <b>{formatMoney(dinero.gastado)}</b></span>{dinero.retirado>0&&<span>Repartido a otro destino <b>{formatMoney(dinero.retirado)}</b></span>}</div>
      {acciones}
      {m.cuentaOrigenId&&m.activa&&m.automatica&&m.mesInicio<=monthKey(todayISO())&&!aportes.some(a=>a.metaId===m.id&&a.mes===monthKey(todayISO())&&a.origen!=='plan')&&dinero.disponible<m.objetivo&&<p className="field-hint">Reserva pendiente. Disponible en origen: {formatMoney(saldos.get(m.cuentaOrigenId)??0)}. Se intentará de nuevo cuando haya saldo.</p>}
    </div>
    {viaje&&<TripBreakdown meta={m}/>}
  </article>;
}
