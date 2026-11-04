import { useCallback, useEffect, useState } from 'react';
import { config } from '../config/neto.config';
import { useHistorialCartera, useInversiones } from '../db/hooks';
import { aplicarCotizaciones, borrarInversion, guardarInversion } from '../db/finance';
import type { Inversion } from '../db/types';
import { todayISO, isISODate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { parseDecimal, valorInversion } from '../lib/investments';
import { cargarCotizaciones, fechaPrecio, precioAntiguo, type Cotizacion } from '../lib/quotes';
import { PageHeader } from '../layout/Shell';
import { Icon } from '../ui/Icon';
import { AmountInput, useAmountField } from '../ui/AmountInput';
import { Modal, useConfirm, useToast } from '../ui/Modal';
import { ValueChart } from '../ui/ValueChart';

function Formulario({ actual, cotizaciones, cerrar }: { actual?: Inversion; cotizaciones: Cotizacion[]; cerrar: () => void }) {
  const [activo, setActivo] = useState(actual?.activoId ?? ''); const [nombre, setNombre] = useState(actual?.nombre ?? '');
  const [tipo, setTipo] = useState<Inversion['tipo']>(actual?.tipo ?? 'otra'); const [cantidad, setCantidad] = useState(actual?.cantidad.toString() ?? '');
  const coste = useAmountField(actual?.coste); const [precio, setPrecio] = useState(actual?.precioEUR.toString() ?? '');
  const [fecha, setFecha] = useState(actual?.precioFecha.slice(0, 10) ?? todayISO());
  const [nota, setNota] = useState(actual?.nota ?? ''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const quote = cotizaciones.find(q => q.id === activo); const confirmar = useConfirm(); const avisar = useToast();
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const unidades = parseDecimal(cantidad); if (unidades === null || unidades <= 0) throw new Error('Introduce una cantidad positiva, sin separadores de miles.');
      if (activo && !quote) throw new Error('Espera a que se cargue la cotización o selecciona valoración manual.');
      const valor = quote?.precioEUR ?? parseDecimal(precio); if (valor === null) throw new Error('Introduce un precio por unidad válido en euros.');
      if (coste.cents === null || coste.cents < 0) throw new Error('Introduce el coste total de compra en euros (puede ser 0).');
      if (!activo && (!fecha || !isISODate(fecha) || fecha > todayISO())) throw new Error('Elige una fecha de valoración válida, hasta hoy.');
      await guardarInversion({ nombre, tipo: quote?.tipo ?? tipo, activoId: activo || null, cantidad: unidades, coste: coste.cents, precioEUR: valor, precioFecha: quote?.fecha ?? fecha, fuente: quote?.fuente ?? 'Manual', nota }, actual?.id);
      avisar(actual ? 'Posición actualizada' : 'Inversión añadida'); cerrar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }
  return <Modal titulo={actual ? 'Editar posición' : 'Añadir inversión'} onClose={cerrar}><form className="modal-body" onSubmit={guardar}>
    <div className="field"><label className="field-label" htmlFor="inv-asset">Activo / fuente de precio</label><select id="inv-asset" className="select" value={activo} onChange={e => { const value = e.target.value; setActivo(value); const q = cotizaciones.find(x => x.id === value); if (q) { setNombre(q.nombre); setTipo(q.tipo); } }} data-autofocus><option value="">Otra inversión · valoración manual</option>{actual?.activoId && !cotizaciones.some(q => q.id === actual.activoId) && <option value={actual.activoId}>{actual.nombre} · cotización no disponible</option>}{cotizaciones.map(q => <option value={q.id} key={q.id}>{q.nombre} ({q.simbolo})</option>)}</select><span className="field-hint">Catálogo con cotizaciones periódicas. Para otros activos, introduce su precio manualmente.</span></div>
    <div className="field"><label className="field-label" htmlFor="inv-name">Nombre de la posición</label><input id="inv-name" className="input" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} required placeholder="Mi cartera de Bitcoin, fondo indexado…" /></div>
    {!activo && <div className="field"><label className="field-label" htmlFor="inv-type">Tipo</label><select id="inv-type" className="select" value={tipo} onChange={e => setTipo(e.target.value as Inversion['tipo'])}>{config.inversiones.tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>}
    <div className="field-row"><div className="field"><label className="field-label" htmlFor="inv-quantity">Cantidad / unidades</label><input id="inv-quantity" className="input" inputMode="decimal" value={cantidad} onChange={e => setCantidad(e.target.value)} required placeholder="0,25" /><span className="field-hint">Hasta 12 decimales, sin separadores de miles.</span></div><div className="field"><label className="field-label" htmlFor="inv-cost">Coste total de compra (€)</label><AmountInput id="inv-cost" texto={coste.texto} onChange={coste.setTexto} /><span className="field-hint">Lo pagado por todas estas unidades, incluidas comisiones.</span></div></div>
    {!activo ? <div className="field-row"><div className="field"><label className="field-label" htmlFor="inv-price">Precio por unidad (€)</label><input id="inv-price" className="input" inputMode="decimal" value={precio} onChange={e => setPrecio(e.target.value)} required placeholder="123,45" /></div><div className="field"><label className="field-label" htmlFor="inv-date">Fecha de valoración</label><input id="inv-date" className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required /></div></div> : quote && <div className="finance-notice">{new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR', maximumFractionDigits:6 }).format(quote.precioEUR)} por unidad · {fechaPrecio(quote.fecha)}<br /><span className="field-hint">{quote.fuente}{precioAntiguo(quote.fecha) ? ' · Precio anterior a 48 horas' : ''}</span></div>}
    <div className="field"><label className="field-label" htmlFor="inv-note">Notas</label><input id="inv-note" className="input" value={nota} onChange={e => setNota(e.target.value)} maxLength={250} placeholder="Plataforma o información de la posición" /></div>
    <p className="field-hint">Registrar una posición no realiza una compra ni modifica el saldo de tus cuentas. Las inversiones se resumen por separado para evitar contarlas dos veces.</p>
    {error && <div role="alert" className="form-error">{error}</div>}
    <div className="modal-footer">{actual && <button type="button" className="btn btn-ghost left" disabled={busy} onClick={async () => { if (await confirmar({ titulo: 'Eliminar posición', mensaje: `Se eliminará «${actual.nombre}» de tu cartera actual. Su valor anterior seguirá en el histórico. Esto no vende el activo.`, confirmar: 'Eliminar', peligro: true })) { try { await borrarInversion(actual.id); cerrar(); } catch { setError('No se pudo eliminar.'); } } }}>Eliminar</button>}<button type="button" className="btn btn-ghost" onClick={cerrar}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
  </form></Modal>;
}

export function Inversiones() {
  const inversiones = useInversiones(); const historial = useHistorialCartera();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ actual?: Inversion } | null>(null); const [seleccion, setSeleccion] = useState('');
  const [filtro, setFiltro] = useState(''); const avisar = useToast();
  const actualizar = useCallback(async (signal?: AbortSignal, manual = false) => {
    setBusy(true); setError('');
    try {
      const precios = await cargarCotizaciones(signal); if (signal?.aborted) return;
      await aplicarCotizaciones(precios); if (signal?.aborted) return; setCotizaciones(precios);
      if (manual) avisar('Cotizaciones consultadas. Revisa la fecha de cada activo.');
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'No se pudo actualizar. Se conservan tus precios guardados.'); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, [avisar]);
  useEffect(() => { const controller = new AbortController(); void actualizar(controller.signal); return () => controller.abort(); }, [actualizar]);
  const total = inversiones.reduce((s, i) => s + valorInversion(i), 0); const coste = inversiones.reduce((s, i) => s + i.coste, 0);
  const elegido = inversiones.find(i => i.id === seleccion); const quote = elegido?.activoId ? cotizaciones.find(q => q.id === elegido.activoId) : undefined;
  const mercado = quote?.historial?.filter(p => Number.isFinite(p.precioEUR) && p.precioEUR > 0 && Number.isFinite(Date.parse(p.fecha))).map(p => ({ fecha: p.fecha, valor: p.precioEUR })) ?? [];
  const diario = new Map<string, { fecha: string; valor: number }>();
  for (const h of historial) { const v = elegido ? h.valores[elegido.id] : h.total; if (v !== undefined) diario.set(h.fecha.slice(0,10), { fecha: h.fecha.slice(0,10), valor: v / 100 }); }
  const data = elegido && mercado.length ? mercado : [...diario.values()];
  const antiguas = inversiones.filter(i => precioAntiguo(i.precioFecha)).length;
  const automaticasSinPrecio = inversiones.filter(i => i.activoId && !cotizaciones.some(q => q.id === i.activoId)).length;
  return <>
    <PageHeader titulo="Inversión" subtitulo="Tu patrimonio invertido, con perspectiva." acciones={<><button className="btn btn-secondary" disabled={busy} onClick={() => void actualizar(undefined, true)}>{busy ? 'Consultando…' : 'Actualizar precios'}</button><button className="btn btn-primary" onClick={() => setForm({})}><Icon name="mas" size={16} />Añadir inversión</button></>} />
    <div className="stack">
      {error && <div className="finance-notice" role="alert">{error}</div>}
      <div className="grid grid-3"><section className="card card-inverse"><div className="eyebrow">Patrimonio invertido</div><div className="mid-number">{formatMoney(total)}</div><p className="field-hint">{inversiones.length} posiciones · valoración en euros</p></section><section className="card"><div className="eyebrow">Coste de las posiciones</div><div className="mid-number">{formatMoney(coste)}</div><p className="field-hint">Coste de compra que has registrado.</p></section><section className="card card-highlight"><div className="eyebrow">Diferencia frente al coste</div><div className="mid-number">{formatMoney(total - coste, { signo: 'siempre' })}</div><p className="field-hint">{coste > 0 ? `${((total - coste) / coste * 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} % · ` : ''}Valoración sin ventas ni dividendos.</p></section></div>
      {(antiguas > 0 || (!busy && automaticasSinPrecio > 0)) && <div className="finance-notice">{antiguas > 0 && `${antiguas} posiciones tienen precios anteriores a ${config.inversiones.antiguedadAvisoHoras} horas. `}{!busy && automaticasSinPrecio > 0 && `${automaticasSinPrecio} posiciones conservan el precio guardado porque no hay una cotización disponible en el catálogo. `}Consulta la fecha y la fuente antes de interpretar el total.</div>}
      <section className="card"><div className="card-header"><div><h2 className="card-title">{elegido ? elegido.nombre : 'Evolución de tu cartera'}</h2><div className="card-sub">{elegido && mercado.length ? 'Cotización de mercado · EUR por unidad' : 'Valoraciones registradas · EUR'}</div></div><select className="select finance-select" aria-label="Ver evolución de" value={elegido?.id ?? ''} onChange={e => setSeleccion(e.target.value)}><option value="">Toda la cartera</option>{inversiones.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></div>
        <ValueChart key={seleccion + (mercado.length ? '-market' : '-portfolio')} datos={data} etiqueta={elegido?.nombre ?? 'la cartera'} precio={!!elegido && mercado.length > 0} />
        <p className="field-hint">{elegido && mercado.length ? `Histórico disponible de mercado, independiente de cuándo compraste. Fuente: ${quote?.fuente}.` : 'El histórico empieza al registrar tus posiciones y guarda la última valoración de cada día. Incluye cambios de cantidad, altas y bajas; no representa una rentabilidad ajustada por aportaciones.'}</p>
      </section>
      <section className="card"><div className="card-header"><h2 className="card-title">Tus posiciones</h2><select className="select finance-select" aria-label="Filtrar tipo de inversión" value={filtro} onChange={e => setFiltro(e.target.value)}><option value="">Todos los activos</option>{config.inversiones.tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
      {!inversiones.length ? <div className="empty"><div className="empty-title">Empieza a reunir tus inversiones</div><div>Añade cripto, divisas, acciones, fondos u otros activos. Sus precios y cantidades se guardan en tu navegador.</div><button className="btn btn-secondary" onClick={() => setForm({})}>Añadir la primera</button></div> : !inversiones.some(i => !filtro || i.tipo === filtro) ? <div className="empty">No hay posiciones de este tipo.</div> : <div className="list">{inversiones.filter(i => !filtro || i.tipo === filtro).map(i => <div key={i.id} className="investment-row"><button className="finance-row-main" onClick={() => { setSeleccion(i.id); document.querySelector('.value-chart')?.scrollIntoView({ block: 'center' }); }}><span className="finance-avatar"><Icon name="inversion" /></span><span><strong>{i.nombre}</strong><span className="row-sub">{i.cantidad.toLocaleString('es-ES', { maximumFractionDigits: 12 })} unidades · {i.activoId ? 'Cotización periódica' : 'Manual'}</span><span className="quote-source">{fechaPrecio(i.precioFecha)} · {i.fuente}</span></span><span className="finance-amount">{formatMoney(valorInversion(i))}<small>{formatMoney(valorInversion(i) - i.coste, { signo: 'siempre' })}</small></span></button><button className="btn btn-secondary btn-sm" aria-label={`Editar ${i.nombre}`} onClick={() => setForm({ actual: i })}>Editar</button></div>)}</div>}
      </section>
      <p className="field-hint">Precios publicados aproximadamente cada 6 horas, sujetos a disponibilidad y horario del mercado. Las divisas usan el último cambio de referencia del BCE; las acciones en otra moneda se convierten a euros. Las posiciones manuales se actualizan al editar su valoración. No se envían tus posiciones a los proveedores.</p>
    </div>
    {form && <Formulario actual={form.actual} cotizaciones={cotizaciones} cerrar={() => setForm(null)} />}
  </>;
}
