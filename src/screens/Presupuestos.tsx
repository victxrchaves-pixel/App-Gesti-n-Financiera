import { type CSSProperties } from 'react';
import { ColorPicker } from '../ui/ColorPicker';
import { esColor, tinta, mezclar } from '../lib/colors';
import { useState } from 'react';
import { useCategorias, useCuentas, useMovimientos, usePresupuestos } from '../db/hooks';
import type { Categoria, Movimiento, Presupuesto } from '../db/types';
import { borrarPresupuesto, copiarPresupuestos, guardarPresupuesto } from '../db/budgets';
import { estadoPresupuesto, gastosPresupuesto, mesValido, resumenPresupuestos } from '../lib/budgets';
import { addMonths, monthKey, monthLabel, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { config } from '../config/neto.config';
import { PageHeader } from '../layout/Shell';
import { AmountInput, useAmountField } from '../ui/AmountInput';
import { Icon } from '../ui/Icon';
import { Modal, useConfirm, useToast } from '../ui/Modal';
import { GoalPlans } from '../ui/GoalPlans';
import { Progress } from '../ui/Progress';
import { db } from '../db/db';
import { crearCategoria } from '../db/repo';
import { MovimientoForm } from '../ui/MovimientoForm';
import { MovimientoRow } from '../ui/MovimientoRow';

function Formulario({ mes, categorias, actual, inicialCategoria, cerrar }: { mes: string; categorias: Categoria[]; actual?: Presupuesto; inicialCategoria?: string; cerrar: () => void }) {
  const [categoriaId, setCategoriaId] = useState(actual?.categoriaId ?? inicialCategoria ?? categorias[0]?.id ?? '');
  const importe = useAmountField(actual?.limite);
  const [nueva, setNueva] = useState('');
  const [color, setColor] = useState<string | null>(actual?.color ?? null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const confirmar = useConfirm(); const avisar = useToast();
  return <Modal titulo={actual ? 'Editar presupuesto' : 'Nuevo presupuesto'} onClose={cerrar}><form className="modal-body" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await db.transaction('rw', db.categorias, db.presupuestos, async () => {
        let id = categoriaId;
        if (id === '__new') { if (!nueva.trim()) throw new Error('Escribe el nombre de la categoría.'); const existente = (await db.categorias.toArray()).find(c => c.tipo === 'gasto' && c.nombre.toLowerCase() === nueva.trim().toLowerCase()); id = existente?.id ?? await crearCategoria(nueva.trim(), 'gasto', '#707070'); }
        await guardarPresupuesto({ mes, categoriaId: id, limite: importe.cents ?? 0, color }, actual?.id);
      }); avisar('Presupuesto guardado'); cerrar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }}>
    <p className="field-hint">Finanzas personales · {monthLabel(mes)}</p>
    <div className="field"><label className="field-label" htmlFor="budget-category">Categoría</label><select id="budget-category" className="select" value={categoriaId} onChange={e => setCategoriaId(e.target.value)} required data-autofocus>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}<option value="__new">Otra categoría…</option></select></div>{categoriaId === '__new' && <div className="field"><label className="field-label" htmlFor="budget-new">Nombre de la categoría</label><input id="budget-new" className="input" value={nueva} onChange={e => setNueva(e.target.value)} maxLength={40} required /></div>}
    <div className="field"><label className="field-label" htmlFor="budget-limit">Límite mensual</label><AmountInput id="budget-limit" texto={importe.texto} onChange={importe.setTexto} grande /><span className="field-hint">Este límite se aplica solo al mes seleccionado. Podrás copiarlo a otros meses.</span></div>
    <ColorPicker etiqueta="Color del presupuesto" valor={color ?? categorias.find(c => c.id === categoriaId)?.color ?? '#707070'} onChange={setColor} restablecer={() => setColor(null)} textoRestablecer="Usar color de categoría" />
    <p className="field-hint">Los gastos de esta categoría se suman automáticamente desde Movimientos. Crear un presupuesto no mueve dinero.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="modal-footer">{actual && <button type="button" className="btn btn-ghost left" disabled={busy} onClick={async () => {
      if (!await confirmar({ titulo: 'Eliminar presupuesto', mensaje: 'Se eliminará el límite de esta categoría para este mes. Tus movimientos se conservarán.', confirmar: 'Eliminar', peligro: true })) return;
      setBusy(true); try { await borrarPresupuesto(actual.id); avisar('Presupuesto eliminado'); cerrar(); } catch { setError('No se pudo eliminar.'); } finally { setBusy(false); }
    }}>Eliminar</button>}<button className="btn btn-ghost" type="button" onClick={cerrar}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
  </form></Modal>;
}

function PlanMes({ mes }: { mes: string }) {
  const categorias = useCategorias(); const cuentas = useCuentas(); const movimientos = useMovimientos();
  const presupuestos = usePresupuestos(mes).filter(p => p.mes === mes);
  const anterior = addMonths(mes, -1);
  const previos = usePresupuestos(anterior).filter(p => p.mes === anterior);
  const [form, setForm] = useState<{ actual?: Presupuesto; categoriaId?: string } | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [movimiento, setMovimiento] = useState<{ actual?: Movimiento } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const confirmar = useConfirm(); const avisar = useToast();
  const hoy = todayISO(); const gastos = gastosPresupuesto(movimientos, cuentas, mes, hoy);
  const resumen = resumenPresupuestos(presupuestos, gastos);
  const mapa = new Map(categorias.map(c => [c.id, c])); const mapaCuentas = new Map(cuentas.map(c => [c.id, c]));
  const disponibles = categorias.filter(c => c.tipo === 'gasto' && !presupuestos.some(p => p.categoriaId === c.id));
  const categoriasForm = categorias.filter(c => c.tipo === 'gasto' && (c.id === form?.actual?.categoriaId || disponibles.some(d => d.id === c.id)));
  if (form?.categoriaId) categoriasForm.sort((a, b) => Number(b.id === form.categoriaId) - Number(a.id === form.categoriaId));
  const cubiertos = new Set(presupuestos.map(p => p.categoriaId));
  const avisos = resumen.filas.filter(p => p.gastado / p.limite * 100 >= config.presupuestos.avisoPorcentaje);
  const sinLimite = new Map<string, number>();
  for (const g of gastos) if (!g.categoriaId || !cubiertos.has(g.categoriaId)) sinLimite.set(g.categoriaId ?? '', (sinLimite.get(g.categoriaId ?? '') ?? 0) + g.importe);
  const movimientosDetalle = gastos.filter(g => (g.categoriaId ?? '') === detalle).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const estiloColor = (color?: string | null) => esColor(color) ? { '--budget-ink': tinta(color), '--budget-soft': mezclar(color, 255, .92), '--budget-color': color } as CSSProperties : undefined;
  return <div className="stack">
    <div className="budget-actions"><span className="field-hint">Un plan para cada mes, a tu ritmo.</span><div><button className="btn btn-secondary" disabled={busy || !previos.some(p => !cubiertos.has(p.categoriaId))} onClick={async () => {
      if (!await confirmar({ titulo: 'Copiar presupuestos', mensaje: `Se añadirán a ${monthLabel(mes)} los límites de ${monthLabel(anterior)} que todavía no existan. Se conservarán los límites actuales y no se copiarán movimientos.`, confirmar: 'Copiar límites' })) return;
      setBusy(true); setError(''); try { const n = await copiarPresupuestos(anterior, mes); avisar(`${n} presupuestos copiados`); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo copiar.'); } finally { setBusy(false); }
    }}>Copiar mes anterior</button><button className="btn btn-primary" onClick={() => setForm({})}><Icon name="mas" size={16} />Nuevo presupuesto</button></div></div>
    {error && <div className="finance-notice" role="alert">{error}</div>}
    <div className="plan-overview"><div><span className="eyebrow">Tu plan para gastar</span><strong>{formatMoney(resumen.limite)}</strong><span>{presupuestos.length} {presupuestos.length===1?'sobre':'sobres'} · {formatMoney(resumen.gastado)} utilizados</span></div><div className="plan-free"><span>{resumen.restante < 0 ? 'Exceso' : 'Queda por gastar'}</span><b>{formatMoney(Math.abs(resumen.restante))}</b></div><Progress valor={resumen.gastado} total={resumen.limite} etiqueta="Consumo total del plan" /></div>
    <div className="planner-layout"><div className="stack">
    {avisos.length > 0 && <div className="finance-notice" role="status"><strong>{avisos.length} {avisos.length === 1 ? 'categoría necesita' : 'categorías necesitan'} atención.</strong> {avisos.map(p => `${mapa.get(p.categoriaId)?.nombre ?? 'Categoría'}: ${estadoPresupuesto(p.gastado, p.limite).toLowerCase()}`).join(' · ')}.</div>}
    {!presupuestos.length ? <div className="plan-get-started"><h2 className="card-title">Escoge tus primeros sobres</h2><p className="field-hint">Ya tienes propuestas debajo: elige las que quieras usar y ajusta su límite.</p></div> : <>
      <section><div className="card-header"><h2 className="card-title">Tus límites por categoría</h2><span className="field-hint">Aviso a partir del {config.presupuestos.avisoPorcentaje} %</span></div><div className="envelope-grid">{resumen.filas.sort((a, b) => (mapa.get(a.categoriaId)?.orden ?? 0) - (mapa.get(b.categoriaId)?.orden ?? 0)).map(p => {
        const nombre = mapa.get(p.categoriaId)?.nombre ?? 'Categoría'; const restante = p.limite - p.gastado; const estado = estadoPresupuesto(p.gastado, p.limite);
        return <article className="card budget-card" style={estiloColor(p.color ?? mapa.get(p.categoriaId)?.color)} key={p.id} aria-label={`Presupuesto de ${nombre}`}><div className="budget-card-top"><span className="finance-avatar"><Icon name={nombre === 'Casa' ? 'casa' : nombre === 'Comida' ? 'comida' : nombre === 'Transporte' ? 'transporte' : nombre === 'Ocio' ? 'ocio' : 'presupuestos'} /></span><h3>{nombre}</h3><button className="btn btn-ghost btn-sm" aria-label={`Editar presupuesto de ${nombre}`} onClick={() => setForm({ actual: p })}>Editar</button></div><div className="budget-remaining"><strong>{formatMoney(Math.abs(restante))}</strong><span>{restante < 0 ? 'por encima del límite' : 'disponibles'}</span></div><div className="budget-figures"><span>Gastado <b>{formatMoney(p.gastado)}</b></span><span>Límite <b>{formatMoney(p.limite)}</b></span></div><Progress valor={p.gastado} total={p.limite} etiqueta={`Consumo de ${nombre}`} color={p.color ?? mapa.get(p.categoriaId)?.color} /><div className="budget-card-bottom"><span className={`budget-status${estado !== 'Dentro del límite' ? ' budget-status-attention' : ''}`}><i />{estado} · {(p.gastado / p.limite * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %</span><button className="btn btn-ghost btn-sm" aria-label={`Ver gastos de ${nombre}`} onClick={() => setDetalle(p.categoriaId)}>Ver gastos</button></div></article>;
      })}</div></section>
    </>}
    {sinLimite.size > 0 && <section className="card"><div className="card-header"><div><h2 className="card-title">Gastos sin presupuesto</h2><div className="card-sub">No están incluidos en el disponible del plan.</div></div><strong>{formatMoney(resumen.sinPresupuesto)}</strong></div>{[...sinLimite].map(([id, importe]) => <div className="budget-unplanned" key={id}><button className="btn btn-ghost" onClick={() => setDetalle(id)}>{mapa.get(id)?.nombre ?? 'Sin categoría'}</button><strong>{formatMoney(importe)}</strong>{disponibles.some(c => c.id === id) && <button className="btn btn-secondary btn-sm" aria-label={`Asignar límite a ${mapa.get(id)?.nombre}`} onClick={() => setForm({ categoriaId: id })}>Asignar límite</button>}</div>)}</section>}
    <section className="budget-picks"><h2 className="card-title">Elige qué incluir en tu plan</h2><p className="field-hint">Empieza por estas categorías. Tú decides el límite de cada una.</p><div className="pick-list">{disponibles.map(c => <button key={c.id} className="plan-pick" onClick={() => setForm({ categoriaId:c.id })}><Icon name={c.nombre === 'Casa' ? 'casa' : c.nombre === 'Comida' ? 'comida' : c.nombre === 'Transporte' ? 'transporte' : c.nombre === 'Ocio' ? 'ocio' : 'presupuestos'} /><span>{c.nombre}</span><Icon name="mas" size={16} /></button>)}<button className="plan-pick" onClick={() => setForm({ categoriaId:'__new' })}><Icon name="mas" /><span>Otra categoría</span></button></div></section>
    </div><GoalPlans mes={mes} /></div>
    <p className="field-hint">Se cuentan los gastos de tus cuentas personales, incluidas las archivadas, con fecha hasta hoy dentro del mes seleccionado. Las transferencias y los gastos del negocio quedan fuera. Una suscripción cuenta cuando registras su pago en Movimientos. Los avisos se muestran dentro de la app.</p>
    {form && <Formulario mes={mes} inicialCategoria={form.categoriaId} categorias={categoriasForm} actual={form.actual} cerrar={() => setForm(null)} />}
    {detalle !== null && <Modal titulo={`Gastos de ${mapa.get(detalle)?.nombre ?? 'Sin categoría'}`} onClose={() => setDetalle(null)}><div className="modal-body"><p className="field-hint">{monthLabel(mes)} · {formatMoney(movimientosDetalle.reduce((s, m) => s + m.importe, 0))}</p>{movimientosDetalle.length ? <div className="list">{movimientosDetalle.map(m => <MovimientoRow key={m.id} m={m} categorias={mapa} cuentas={mapaCuentas} onClick={() => { setDetalle(null); setMovimiento({ actual: m }); }} />)}</div> : <div className="empty">Todavía no hay gastos en esta categoría este mes.</div>}<div className="modal-footer"><button className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button></div></div></Modal>}
    {movimiento && <MovimientoForm movimiento={movimiento.actual} onClose={() => setMovimiento(null)} />}
  </div>;
}

export function Presupuestos() {
  const [mes, setMes] = useState(monthKey(todayISO()));
  return <><PageHeader titulo="Presupuestos" subtitulo="Haz espacio para lo que importa." /><div className="toolbar budget-toolbar"><div className="month-nav"><button className="btn btn-ghost btn-icon" disabled={mes <= '1900-01'} onClick={() => setMes(addMonths(mes, -1))} aria-label="Mes anterior"><Icon name="izquierda" size={18} /></button><label className="sr-only" htmlFor="budget-month">Mes del presupuesto</label><input id="budget-month" className="input" type="month" value={mes} min="1900-01" max="9999-12" onChange={e => { if (mesValido(e.target.value) && e.target.value >= '1900-01') setMes(e.target.value); }} /><button className="btn btn-ghost btn-icon" disabled={mes >= '9999-12'} onClick={() => setMes(addMonths(mes, 1))} aria-label="Mes siguiente"><Icon name="derecha" size={18} /></button></div>{mes !== monthKey(todayISO()) && <button className="btn btn-ghost" onClick={() => setMes(monthKey(todayISO()))}>Volver a este mes</button>}<span className="budget-scope">Finanzas personales</span></div><PlanMes key={mes} mes={mes} /></>;
}
