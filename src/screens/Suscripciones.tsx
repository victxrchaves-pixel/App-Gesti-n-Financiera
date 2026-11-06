import { SERVICIOS, identificarServicio } from '../lib/services';
import { ServiceIcon } from '../ui/ServiceIcon';
import { useState } from 'react';
import { config } from '../config/neto.config';
import { useSuscripciones } from '../db/hooks';
import { db } from '../db/db';
import { guardarSuscripcion, renovarSuscripcion } from '../db/finance';
import type { Ambito, Suscripcion } from '../db/types';
import { addDays, shortDate, todayISO } from '../lib/dates';
import { costeAnual, costeMensual } from '../lib/subscriptions';
import { formatMoney } from '../lib/money';
import { PageHeader } from '../layout/Shell';
import { Icon } from '../ui/Icon';
import { Modal, useConfirm, useToast } from '../ui/Modal';
import { AmountInput, useAmountField } from '../ui/AmountInput';

export function FormularioSuscripcion({ actual, servicioInicial, ambito, categorias, cerrar }: { actual?: Suscripcion; servicioInicial?: string; ambito: Ambito; categorias: string[]; cerrar: () => void }) {
  const inicial = SERVICIOS.find(s=>s.id===servicioInicial);
  const [servicio, setServicio] = useState(actual?.servicioId ?? identificarServicio(actual?.nombre ?? '')?.id ?? inicial?.id ?? '');
  const [nombre, setNombre] = useState(actual?.nombre ?? inicial?.nombre ?? '');
  const [categoria, setCategoria] = useState(actual?.categoria ?? inicial?.categoria ?? categorias[0] ?? 'Otros');
  const importe = useAmountField(actual?.importe);
  const [periodo, setPeriodo] = useState<Suscripcion['periodo']>(actual?.periodo ?? 'mensual');
  const [fecha, setFecha] = useState(actual?.proximaFecha ?? todayISO());
  const [estado, setEstado] = useState<Suscripcion['estado']>(actual?.estado ?? 'activa');
  const [nota, setNota] = useState(actual?.nota ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const avisar = useToast(); const confirmar = useConfirm();
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      await guardarSuscripcion({ servicioId: servicio || null, nombre, categoria, importe: importe.cents ?? 0, ambito, periodo, proximaFecha: fecha, diaCobro: actual && fecha === actual.proximaFecha ? actual.diaCobro : Number(fecha.slice(-2)), estado, nota }, actual?.id);
      avisar(actual ? 'Suscripción actualizada' : 'Suscripción añadida'); cerrar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }
  return <Modal titulo={actual ? 'Editar suscripción' : 'Nueva suscripción'} onClose={cerrar}>
    <form onSubmit={guardar} className="modal-body">
      <div className="field"><label className="field-label" htmlFor="sub-service">Servicio</label><select id="sub-service" className="select" value={servicio} onChange={e=>{setServicio(e.target.value);const s=SERVICIOS.find(s=>s.id===e.target.value);setNombre(s?.nombre??'');setCategoria(s?.categoria??'Otros');}}><option value="">Otros · escribir mi suscripción</option>{[...new Set(SERVICIOS.map(s=>s.grupo))].map(g=><optgroup label={g} key={g}>{SERVICIOS.filter(s=>s.grupo===g).map(s=><option value={s.id} key={s.id}>{s.nombre}</option>)}</optgroup>)}</select><span className="field-hint">El servicio asigna su icono y categoría. Tú introduces el precio de tu plan.</span></div>
      <div className="field"><label htmlFor="sub-name" className="field-label">Nombre</label><input id="sub-name" className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Netflix, Adobe, ADG-FAD…" maxLength={80} required data-autofocus /></div>
      <div className="field"><label htmlFor="sub-category" className="field-label">Categoría</label><input id="sub-category" className="input" list="sub-categories" value={categoria} onChange={e => setCategoria(e.target.value)} maxLength={60} required /><datalist id="sub-categories">{categorias.map(c => <option key={c} value={c} />)}</datalist><span className="field-hint">Elige una categoría o escribe una nueva.</span></div>
      <div className="field-row"><div className="field"><label htmlFor="sub-amount" className="field-label">Importe de cada cuota</label><AmountInput id="sub-amount" texto={importe.texto} onChange={importe.setTexto} /></div><div className="field"><label htmlFor="sub-period" className="field-label">Periodicidad</label><select id="sub-period" className="select" value={periodo} onChange={e => setPeriodo(e.target.value as Suscripcion['periodo'])}>{config.suscripciones.periodos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div></div>
      <div className="field-row"><div className="field"><label htmlFor="sub-date" className="field-label">Próxima renovación</label><input id="sub-date" className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required /></div><div className="field"><label htmlFor="sub-status" className="field-label">Estado</label><select id="sub-status" className="select" value={estado} onChange={e => setEstado(e.target.value as Suscripcion['estado'])}><option value="activa">Activa</option><option value="pausada">Pausada</option><option value="cancelada">Cancelada</option></select></div></div>
      <div className="field"><label htmlFor="sub-note" className="field-label">Notas</label><input id="sub-note" className="input" value={nota} onChange={e => setNota(e.target.value)} maxLength={250} placeholder="Plan, condiciones de renovación…" /></div>
      <p className="field-hint">Esta suscripción pertenece a {ambito === 'personal' ? 'tus finanzas personales' : 'tu negocio'}. Los avisos se muestran al abrir Neto; no se realizan cobros ni se añaden gastos automáticamente.</p>
      {error && <div role="alert" className="form-error">{error}</div>}
      <div className="modal-footer">{actual && <button type="button" className="btn btn-ghost left" disabled={busy} onClick={async () => { if (await confirmar({ titulo: 'Eliminar suscripción', mensaje: `Se eliminará «${actual.nombre}» de Neto. Esto no cancela el servicio con el proveedor.`, confirmar: 'Eliminar', peligro: true })) { try { await db.suscripciones.delete(actual.id); cerrar(); } catch { setError('No se pudo eliminar la suscripción.'); } } }}>Eliminar</button>}<button type="button" className="btn btn-ghost" onClick={cerrar}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
    </form>
  </Modal>;
}

export function Suscripciones({ ambito = 'personal' }: { ambito?: Ambito }) {
  const todas = useSuscripciones(); const lista = todas.filter(s => s.ambito === ambito);
  const [form, setForm] = useState<{ actual?: Suscripcion; servicioInicial?: string } | null>(null);
  const [categoria, setCategoria] = useState(''); const [estado, setEstado] = useState('activa'); const [busqueda, setBusqueda] = useState('');
  const [grupoServicios,setGrupoServicios]=useState('Cloud');
  const [busy, setBusy] = useState<string | null>(null); const avisar = useToast(); const confirmar = useConfirm();
  const categorias = [...new Set([...config.suscripciones.categorias, ...lista.map(s => s.categoria)])];
  const activas = lista.filter(s => s.estado === 'activa'); const hoy = todayISO();
  const pendientes = activas.filter(s => s.proximaFecha <= addDays(hoy, config.suscripciones.avisoDias));
  const visibles = lista.filter(s => (!categoria || s.categoria === categoria) && (!estado || s.estado === estado) && `${s.nombre} ${s.nota}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()));
  return <>
    <PageHeader titulo={ambito === 'negocio' ? 'Suscripciones del negocio' : 'Suscripciones'} subtitulo="Tus cuotas, planes y renovaciones, en un solo lugar." acciones={<button className="btn btn-primary" onClick={() => setForm({})}><Icon name="mas" size={16} />Nueva suscripción</button>} />
    <div className="stack">
      <section className="subscriptions-ledger"><div className="subscription-total"><Icon name="suscripciones" size={32}/><span>Tu coste recurrente</span><strong>{formatMoney(activas.reduce((s,x)=>s+costeMensual(x),0))}<small>/mes</small></strong><span>{formatMoney(activas.reduce((s,x)=>s+costeAnual(x),0))} al año si mantienes los planes</span></div><div className="renewal-timeline"><h2>Próximas renovaciones</h2>{[...activas].sort((a,b)=>a.proximaFecha.localeCompare(b.proximaFecha)).slice(0,3).map(s=><button key={s.id} onClick={()=>setForm({actual:s})}><span className="renewal-date">{shortDate(s.proximaFecha)}</span><ServiceIcon id={s.servicioId} nombre={s.nombre}/><span>{s.nombre}</span><strong>{formatMoney(s.importe)}</strong></button>)}{!activas.length&&<p className="field-hint">Tus próximos cobros aparecerán aquí al añadir un servicio.</p>}<span className="field-hint">{pendientes.length} renovaciones por revisar</span></div></section>
      <section className="subscriptions-collection"><h2 className="card-title">Mis suscripciones</h2><div className="toolbar"><input className="input input-search" aria-label="Buscar suscripciones" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar suscripción" /><select aria-label="Filtrar categoría" className="select" value={categoria} onChange={e => setCategoria(e.target.value)}><option value="">Todas las categorías</option>{categorias.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Filtrar estado" className="select" value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos los estados</option><option value="activa">Activas</option><option value="pausada">Pausadas</option><option value="cancelada">Canceladas</option></select></div>
      {!visibles.length ? <div className="empty"><div className="empty-title">{lista.length ? 'No hay suscripciones con estos filtros' : 'Ten tus renovaciones a mano'}</div><div>{lista.length ? 'Prueba con otra categoría o estado.' : 'Añade plataformas, aplicaciones, asociaciones o cualquier cuota recurrente.'}</div>{!lista.length && <button className="btn btn-secondary" onClick={() => setForm({})}>Añadir la primera</button>}</div> : <div className="subscription-grid">{visibles.map(s => <article className="subscription-card" key={s.id} aria-label={`Suscripción ${s.nombre}`}>
        <button className="subscription-card-heading" aria-label={`Editar suscripción ${s.nombre}`} onClick={() => setForm({ actual:s })}><ServiceIcon id={s.servicioId} nombre={s.nombre}/><span><strong>{s.nombre}</strong><small>{s.categoria}</small></span><Icon name="derecha" size={16}/></button>
        <div className="subscription-card-price"><strong>{formatMoney(s.importe)}</strong><span>/{s.periodo === 'mensual' ? 'mes' : s.periodo === 'anual' ? 'año' : 'trimestre'}</span></div>
        <div className="subscription-card-state"><span className={`subscription-state state-${s.estado}`}><i/>{s.estado==='activa'?'Activa':s.estado==='pausada'?'Pausada':'Cancelada'}</span>{s.estado==='activa'&&s.proximaFecha<=hoy&&<span className="renewal-warning">Por revisar</span>}</div>
        <div className="subscription-card-date"><span>{s.estado==='activa'?'Próxima renovación':'Fecha de referencia'}</span><strong>{shortDate(s.proximaFecha)}</strong></div>
        {s.nota&&<p className="subscription-card-note">{s.nota}</p>}
        <div className="subscription-card-footer"><button className="btn btn-ghost btn-sm" aria-label={`Editar ${s.nombre}`} onClick={()=>setForm({actual:s})}>Editar</button>{s.estado==='activa'&&<button className="btn btn-secondary btn-sm" disabled={busy===s.id} onClick={async()=>{if(busy)return;if(!await confirmar({titulo:'Avanzar renovación',mensaje:`Se avanzará una cuota desde el ${shortDate(s.proximaFecha)}. Revisa que la renovación de «${s.nombre}» ya se haya producido. No se añadirá un gasto a tus movimientos.`,confirmar:'Avanzar fecha'}))return;setBusy(s.id);try{await renovarSuscripcion(s.id,s.proximaFecha);avisar('Próxima renovación actualizada')}catch(e){avisar(e instanceof Error?e.message:'No se pudo actualizar.')}finally{setBusy(null)}}}>Avanzar fecha</button>}</div>
      </article>)}</div>}

      </section>
      <section className="service-catalog"><div className="card-header"><div><h2 className="card-title">Añade un servicio</h2><p className="card-sub">Elige la app; después, indica tu plan y tu próxima cuota.</p></div><select className="select finance-select" aria-label="Tipo de servicio" value={grupoServicios} onChange={e=>setGrupoServicios(e.target.value)}>{[...new Set(SERVICIOS.map(s=>s.grupo))].map(g=><option key={g}>{g}</option>)}</select></div><div className="service-shelf">{SERVICIOS.filter(s=>s.grupo===grupoServicios).map(s=><button key={s.id} className="service-tile" onClick={()=>setForm({servicioInicial:s.id})}><ServiceIcon id={s.id} nombre={s.nombre}/><span>{s.nombre}</span><Icon name="mas" size={16}/></button>)}<button className="service-tile other-service" onClick={()=>setForm({})}><span className="service-icon"><Icon name="mas"/></span><span>Otros</span></button></div></section>
    </div>
    {form && <FormularioSuscripcion actual={form.actual} servicioInicial={form.servicioInicial} ambito={ambito} categorias={categorias} cerrar={() => setForm(null)} />}
  </>;
}
