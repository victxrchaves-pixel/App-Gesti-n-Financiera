import { useState } from 'react';
import type { Meta, PartidaViaje } from '../db/types';
import { guardarDesglose } from '../db/goals';
import { newId } from '../lib/id';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { resumenDesglose } from '../lib/tripBreakdown';
import { Modal, useToast } from './Modal';
import { AmountInput } from './AmountInput';
import { Icon } from './Icon';

const SUGERENCIAS = ['Vuelos', 'Alojamiento', 'Comida y ocio', 'Transporte', 'Actividades', 'Seguro de viaje'];
interface Borrador { id: string; nombre: string; importe: string }
function Editor({ meta, cerrar }: { meta: Meta; cerrar: () => void }) {
  const [filas, setFilas] = useState<Borrador[]>(() => (meta.desglose ?? []).map(p => ({ ...p, importe: centsToInput(p.importe) })));
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const avisar = useToast();
  const importes = filas.map(f => parseMoney(f.importe));
  const valido = importes.every(n => n !== null);
  const asignado = importes.reduce<number>((s, n) => s + (n ?? 0), 0);
  const sinAsignar = meta.objetivo - asignado;
  const cambiar = (id: string, cambio: Partial<Borrador>) => { setFilas(fs => fs.map(f => f.id === id ? { ...f, ...cambio } : f)); setError(''); };
  const agregar = (nombre = '') => { if (filas.length < 50) { setFilas(fs => [...fs, { id:newId(), nombre, importe:'' }]); setError(''); } };
  return <Modal titulo={`Desglose de ${meta.nombre}`} onClose={cerrar}><form className="modal-body" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setError('');
    if (!valido) return setError('Revisa el importe de cada concepto. Puedes indicar 0 si todavía no lo has decidido.');
    setBusy(true);
    try { await guardarDesglose(meta.id, filas.map((f, i) => ({ id:f.id, nombre:f.nombre, importe:importes[i]! }))); avisar('Desglose del viaje guardado'); cerrar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el desglose.'); }
    finally { setBusy(false); }
  }}>
    <p className="field-hint">Reparte el objetivo de tu viaje entre sus conceptos. Son importes previstos para el viaje completo, no cuotas mensuales ni gastos ya pagados.</p>
    <div className="trip-summary"><div><span>Objetivo del viaje</span><strong>{formatMoney(meta.objetivo)}</strong></div><div><span>Repartido</span><strong>{valido ? formatMoney(asignado) : 'Revisa importes'}</strong></div><div><span>{sinAsignar < 0 ? 'Exceso' : 'Sin asignar'}</span><strong>{valido ? formatMoney(Math.abs(sinAsignar)) : '—'}</strong></div></div>
    <div className="trip-suggestions" aria-label="Conceptos sugeridos">{SUGERENCIAS.filter(nombre => !filas.some(f => f.nombre.trim().toLowerCase() === nombre.toLowerCase())).map(nombre => <button key={nombre} type="button" className="btn btn-secondary btn-sm" disabled={busy || filas.length >= 50} onClick={() => agregar(nombre)}>Añadir {nombre.toLowerCase()}</button>)}</div>
    <div className="trip-editor-list">{filas.map((f, i) => <div key={f.id} className="trip-editor-row"><div className="field"><label className="field-label" htmlFor={`trip-name-${f.id}`}>Concepto {i + 1}</label><input id={`trip-name-${f.id}`} className="input" value={f.nombre} onChange={e => cambiar(f.id, { nombre:e.target.value })} maxLength={60} required placeholder="Vuelos, hoteles…" /></div><div className="field"><label className="field-label" htmlFor={`trip-amount-${f.id}`}>Importe {i + 1}</label><AmountInput id={`trip-amount-${f.id}`} texto={f.importe} onChange={importe => cambiar(f.id, { importe })} /></div><button type="button" className="btn btn-ghost btn-icon" disabled={busy} aria-label={`Eliminar concepto ${i + 1}`} onClick={() => { setFilas(fs => fs.filter(p => p.id !== f.id)); setError(''); }}><Icon name="papelera" size={17} /></button></div>)}</div>
    {!filas.length && <p className="field-hint">Añade un concepto sugerido o crea uno con tu propio nombre.</p>}
    <button className="btn btn-secondary" type="button" disabled={busy || filas.length >= 50} onClick={() => agregar()}><Icon name="mas" size={16} />Otro concepto</button>
    {valido && sinAsignar < 0 && <p className="finance-notice" role="status">Has repartido {formatMoney(-sinAsignar)} más que el objetivo. Ajusta los conceptos o aumenta el objetivo desde «Editar meta».</p>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="modal-footer"><button className="btn btn-ghost" type="button" onClick={cerrar}>Cancelar</button><button className="btn btn-primary" disabled={busy}>Guardar desglose</button></div>
  </form></Modal>;
}
export function TripBreakdown({ meta }: { meta: Meta }) {
  const [abierto, setAbierto] = useState(false);
  const partidas: PartidaViaje[] = meta.desglose ?? [];
  const { asignado, sinAsignar } = resumenDesglose(partidas, meta.objetivo);
  return <section className="trip-breakdown" aria-label={`Desglose del viaje ${meta.nombre}`}>
    <div className="trip-heading"><span><Icon name="viaje" size={16} />Desglose del viaje</span><button type="button" className="btn btn-ghost btn-sm" aria-label={`Desglosar viaje ${meta.nombre}`} onClick={() => setAbierto(true)}>{partidas.length ? 'Editar desglose' : 'Definir desglose'}</button></div>
    {partidas.length ? <><ul className="trip-parts">{partidas.map(p => <li key={p.id}><span>{p.nombre}</span><strong>{formatMoney(p.importe)}</strong></li>)}</ul><div className="trip-remainder"><span>{sinAsignar === 0 ? 'Objetivo repartido' : 'Sin asignar'}</span><strong>{formatMoney(sinAsignar === 0 ? asignado : sinAsignar)}</strong></div></> : <p className="field-hint">Decide cuánto reservar para vuelos, alojamiento, comida y otros gastos del viaje.</p>}
    <p className="trip-note">Planificación dentro del objetivo de {formatMoney(meta.objetivo)}. No suma ahorro ni registra pagos.</p>
    {abierto && <Editor meta={meta} cerrar={() => setAbierto(false)} />}
  </section>;
}
