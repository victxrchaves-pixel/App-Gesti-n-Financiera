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

function Formulario({ actual, ambito, categorias, cerrar }: { actual?: Suscripcion; ambito: Ambito; categorias: string[]; cerrar: () => void }) {
  const [nombre, setNombre] = useState(actual?.nombre ?? '');
  const [categoria, setCategoria] = useState(actual?.categoria ?? categorias[0] ?? 'Otros');
  const importe = useAmountField(actual?.importe);
  const [periodo, setPeriodo] = useState<Suscripcion['periodo']>(actual?.periodo ?? 'mensual');
  const [fecha, setFecha] = useState(actual?.proximaFecha ?? todayISO());
  const [estado, setEstado] = useState<Suscripcion['estado']>(actual?.estado ?? 'activa');
  const [nota, setNota] = useState(actual?.nota ?? '');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const avisar = useToast(); const confirmar = useConfirm();
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      await guardarSuscripcion({ nombre, categoria, importe: importe.cents ?? 0, ambito, periodo, proximaFecha: fecha, diaCobro: actual && fecha === actual.proximaFecha ? actual.diaCobro : Number(fecha.slice(-2)), estado, nota }, actual?.id);
      avisar(actual ? 'Suscripción actualizada' : 'Suscripción añadida'); cerrar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }
  return <Modal titulo={actual ? 'Editar suscripción' : 'Nueva suscripción'} onClose={cerrar}>
    <form onSubmit={guardar} className="modal-body">
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
  const [form, setForm] = useState<{ actual?: Suscripcion } | null>(null);
  const [categoria, setCategoria] = useState(''); const [estado, setEstado] = useState('activa'); const [busqueda, setBusqueda] = useState('');
  const [busy, setBusy] = useState<string | null>(null); const avisar = useToast(); const confirmar = useConfirm();
  const categorias = [...new Set([...config.suscripciones.categorias, ...lista.map(s => s.categoria)])];
  const activas = lista.filter(s => s.estado === 'activa'); const hoy = todayISO();
  const pendientes = activas.filter(s => s.proximaFecha <= addDays(hoy, config.suscripciones.avisoDias));
  const visibles = lista.filter(s => (!categoria || s.categoria === categoria) && (!estado || s.estado === estado) && `${s.nombre} ${s.nota}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()));
  return <>
    <PageHeader titulo={ambito === 'negocio' ? 'Suscripciones del negocio' : 'Suscripciones'} subtitulo="Tus cuotas, planes y renovaciones, en un solo lugar." acciones={<button className="btn btn-primary" onClick={() => setForm({})}><Icon name="mas" size={16} />Nueva suscripción</button>} />
    <div className="stack">
      <div className="grid grid-3"><section className="card card-highlight"><div className="eyebrow">Equivalente mensual</div><div className="mid-number">{formatMoney(activas.reduce((s, x) => s + costeMensual(x), 0))}</div><p className="field-hint">Cuotas activas repartidas por mes.</p></section><section className="card"><div className="eyebrow">Coste anual estimado</div><div className="mid-number">{formatMoney(activas.reduce((s, x) => s + costeAnual(x), 0))}</div><p className="field-hint">Si mantienes los planes y sus precios.</p></section><section className="card"><div className="eyebrow">Renovaciones por revisar</div><div className="mid-number">{pendientes.length}</div><p className="field-hint">Vencidas o en los próximos {config.suscripciones.avisoDias} días.</p></section></div>
      <section className="card"><div className="toolbar"><input className="input input-search" aria-label="Buscar suscripciones" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar suscripción" /><select aria-label="Filtrar categoría" className="select" value={categoria} onChange={e => setCategoria(e.target.value)}><option value="">Todas las categorías</option>{categorias.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Filtrar estado" className="select" value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos los estados</option><option value="activa">Activas</option><option value="pausada">Pausadas</option><option value="cancelada">Canceladas</option></select></div>
      {!visibles.length ? <div className="empty"><div className="empty-title">{lista.length ? 'No hay suscripciones con estos filtros' : 'Ten tus renovaciones a mano'}</div><div>{lista.length ? 'Prueba con otra categoría o estado.' : 'Añade plataformas, aplicaciones, asociaciones o cualquier cuota recurrente.'}</div>{!lista.length && <button className="btn btn-secondary" onClick={() => setForm({})}>Añadir la primera</button>}</div> : <div className="stack">{[...new Set(visibles.map(s => s.categoria))].map(cat => <div key={cat}><h2 className="card-title finance-group-title">{cat}<span className="muted">{visibles.filter(s => s.categoria === cat).length}</span></h2>{visibles.filter(s => s.categoria === cat).map(s => <div className="subscription-row" key={s.id}>
        <button className="finance-row-main" onClick={() => setForm({ actual: s })}><span className="finance-avatar">{s.nombre.slice(0, 2).toLocaleUpperCase()}</span><span><strong>{s.nombre}</strong><span className="row-sub">{s.estado === 'activa' ? `Renueva el ${shortDate(s.proximaFecha)}` : s.estado === 'pausada' ? 'Pausada' : 'Cancelada'}{s.estado === 'activa' && s.proximaFecha <= hoy ? ' · Por revisar' : ''}</span></span><span className="finance-amount">{formatMoney(s.importe)}<small>/{s.periodo === 'mensual' ? 'mes' : s.periodo === 'anual' ? 'año' : 'trimestre'}</small></span></button>
        {s.estado === 'activa' && <button className="btn btn-secondary btn-sm" disabled={busy === s.id} onClick={async () => { if (busy) return; if (!await confirmar({ titulo: 'Avanzar renovación', mensaje: `Se avanzará una cuota desde el ${shortDate(s.proximaFecha)}. Revisa que la renovación de «${s.nombre}» ya se haya producido. No se añadirá un gasto a tus movimientos.`, confirmar: 'Avanzar fecha' })) return; setBusy(s.id); try { await renovarSuscripcion(s.id, s.proximaFecha); avisar('Próxima renovación actualizada'); } catch (e) { avisar(e instanceof Error ? e.message : 'No se pudo actualizar.'); } finally { setBusy(null); } }}>Avanzar fecha</button>}
      </div>)}</div>)}</div>}
      </section>
    </div>
    {form && <Formulario actual={form.actual} ambito={ambito} categorias={categorias} cerrar={() => setForm(null)} />}
  </>;
}
