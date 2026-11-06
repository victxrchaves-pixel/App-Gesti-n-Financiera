import { COLORES_INVERSION } from '../lib/colors';
import { Donut } from '../ui/Donut';
import { useCallback, useEffect, useState } from 'react';
import { config } from '../config/neto.config';
import { useHistorialCartera, useInversiones } from '../db/hooks';
import { aplicarCotizaciones, borrarInversion, guardarInversion } from '../db/finance';
import type { Inversion } from '../db/types';
import { todayISO, isISODate } from '../lib/dates';
import { formatEuros, formatMoney } from '../lib/money';
import { parseDecimal, valorInversion } from '../lib/investments';
import { cargarCotizaciones, fechaPrecio, precioAntiguo, type Cotizacion } from '../lib/quotes';
import { PageHeader } from '../layout/Shell';
import { Icon } from '../ui/Icon';
import { CategoryIcon } from '../ui/CategoryIcon';

/** Icono de cada tipo de inversión (nombres de src/lib/iconos.ts). */
const ICONO_TIPO: Record<string, string> = {
  cripto: 'cripto',
  divisa: 'efectivo',
  accion: 'inversion',
  fondo: 'presupuestos',
  otra: 'otros',
};
import { AmountInput, useAmountField } from '../ui/AmountInput';
import { Modal, useConfirm, useToast } from '../ui/Modal';
import { ValueChart } from '../ui/ValueChart';

function Formulario({
  actual,
  cotizaciones,
  cerrar,
}: {
  actual?: Inversion;
  cotizaciones: Cotizacion[];
  cerrar: () => void;
}) {
  const [activo, setActivo] = useState(actual?.activoId ?? '');
  const [nombre, setNombre] = useState(actual?.nombre ?? '');
  const [tipo, setTipo] = useState<Inversion['tipo']>(actual?.tipo ?? 'otra');
  const [cantidad, setCantidad] = useState(actual?.cantidad.toString() ?? '');
  const coste = useAmountField(actual?.coste);
  const [precio, setPrecio] = useState(actual?.precioEUR.toString() ?? '');
  const [fecha, setFecha] = useState(actual?.precioFecha.slice(0, 10) ?? todayISO());
  const [nota, setNota] = useState(actual?.nota ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const quote = cotizaciones.find((q) => q.id === activo);
  const confirmar = useConfirm();
  const avisar = useToast();
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const unidades = parseDecimal(cantidad);
      if (unidades === null || unidades <= 0)
        throw new Error('Introduce una cantidad positiva, sin separadores de miles.');
      if (activo && !quote) throw new Error('Espera a que se cargue la cotización o selecciona valoración manual.');
      const valor = quote?.precioEUR ?? parseDecimal(precio);
      if (valor === null) throw new Error('Introduce un precio por unidad válido en euros.');
      if (coste.cents === null || coste.cents < 0)
        throw new Error('Introduce el coste total de compra en euros (puede ser 0).');
      if (!activo && (!fecha || !isISODate(fecha) || fecha > todayISO()))
        throw new Error('Elige una fecha de valoración válida, hasta hoy.');
      await guardarInversion(
        {
          nombre,
          tipo: quote?.tipo ?? tipo,
          activoId: activo || null,
          cantidad: unidades,
          coste: coste.cents,
          precioEUR: valor,
          precioFecha: quote?.fecha ?? fecha,
          fuente: quote?.fuente ?? 'Manual',
          nota,
        },
        actual?.id,
      );
      avisar(actual ? 'Posición actualizada' : 'Inversión añadida');
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal titulo={actual ? 'Editar posición' : 'Añadir inversión'} onClose={cerrar}>
      <form className="modal-body" onSubmit={guardar}>
        <div className="field">
          <label className="field-label" htmlFor="inv-asset">
            Activo / fuente de precio
          </label>
          <select
            id="inv-asset"
            className="select"
            value={activo}
            onChange={(e) => {
              const value = e.target.value;
              setActivo(value);
              const q = cotizaciones.find((x) => x.id === value);
              if (q) {
                setNombre(q.nombre);
                setTipo(q.tipo);
              }
            }}
            data-autofocus
          >
            <option value="">Otra inversión · valoración manual</option>
            {actual?.activoId && !cotizaciones.some((q) => q.id === actual.activoId) && (
              <option value={actual.activoId}>{actual.nombre} · cotización no disponible</option>
            )}
            {cotizaciones.map((q) => (
              <option value={q.id} key={q.id}>
                {q.nombre} ({q.simbolo})
              </option>
            ))}
          </select>
          <span className="field-hint">
            Catálogo con cotizaciones periódicas. Para otros activos, introduce su precio manualmente.
          </span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="inv-name">
            Nombre de la posición
          </label>
          <input
            id="inv-name"
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
            required
            placeholder="Mi cartera de Bitcoin, fondo indexado…"
          />
        </div>
        {!activo && (
          <div className="field">
            <label className="field-label" htmlFor="inv-type">
              Tipo
            </label>
            <select
              id="inv-type"
              className="select"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Inversion['tipo'])}
            >
              {config.inversiones.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="inv-quantity">
              Cantidad / unidades
            </label>
            <input
              id="inv-quantity"
              className="input"
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
              placeholder="0,25"
            />
            <span className="field-hint">Hasta 12 decimales, sin separadores de miles.</span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="inv-cost">
              Coste total de compra (€)
            </label>
            <AmountInput id="inv-cost" texto={coste.texto} onChange={coste.setTexto} />
            <span className="field-hint">Lo pagado por todas estas unidades, incluidas comisiones.</span>
          </div>
        </div>
        {!activo ? (
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="inv-price">
                Precio por unidad (€)
              </label>
              <input
                id="inv-price"
                className="input"
                inputMode="decimal"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                required
                placeholder="123,45"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="inv-date">
                Fecha de valoración
              </label>
              <input
                id="inv-date"
                className="input"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
          </div>
        ) : (
          quote && (
            <div className="finance-notice">
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 6 }).format(
                quote.precioEUR,
              )}{' '}
              por unidad · {fechaPrecio(quote.fecha)}
              <br />
              <span className="field-hint">
                {quote.fuente}
                {precioAntiguo(quote.fecha) ? ' · Precio anterior a 48 horas' : ''}
              </span>
            </div>
          )
        )}
        <div className="field">
          <label className="field-label" htmlFor="inv-note">
            Notas
          </label>
          <input
            id="inv-note"
            className="input"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={250}
            placeholder="Plataforma o información de la posición"
          />
        </div>
        <p className="field-hint">
          Registrar una posición no realiza una compra ni modifica el saldo de tus cuentas. Las inversiones se resumen
          por separado para evitar contarlas dos veces.
        </p>
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        <div className="modal-footer">
          {actual && (
            <button
              type="button"
              className="btn btn-ghost left"
              disabled={busy}
              onClick={async () => {
                if (
                  await confirmar({
                    titulo: 'Eliminar posición',
                    mensaje: `Se eliminará «${actual.nombre}» de tu cartera actual. Su valor anterior seguirá en el histórico. Esto no vende el activo.`,
                    confirmar: 'Eliminar',
                    peligro: true,
                  })
                ) {
                  try {
                    await borrarInversion(actual.id);
                    cerrar();
                  } catch {
                    setError('No se pudo eliminar.');
                  }
                }
              }}
            >
              Eliminar
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Inversiones() {
  const [modo, setModo] = useState<'valor' | 'precio'>('valor');
  const inversiones = useInversiones();
  const historial = useHistorialCartera();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ actual?: Inversion } | null>(null);
  const [seleccion, setSeleccion] = useState('');
  const [filtro, setFiltro] = useState('');
  const avisar = useToast();
  const actualizar = useCallback(
    async (signal?: AbortSignal, manual = false) => {
      setBusy(true);
      setError('');
      try {
        const precios = await cargarCotizaciones(signal);
        if (signal?.aborted) return;
        await aplicarCotizaciones(precios);
        if (signal?.aborted) return;
        setCotizaciones(precios);
        if (manual) avisar('Cotizaciones consultadas. Revisa la fecha de cada activo.');
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : 'No se pudo actualizar. Se conservan tus precios guardados.');
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [avisar],
  );
  useEffect(() => {
    const controller = new AbortController();
    void actualizar(controller.signal);
    return () => controller.abort();
  }, [actualizar]);
  const total = inversiones.reduce((s, i) => s + valorInversion(i), 0);
  const coste = inversiones.reduce((s, i) => s + i.coste, 0);
  const elegido = inversiones.find((i) => i.id === seleccion);
  const quote = elegido?.activoId ? cotizaciones.find((q) => q.id === elegido.activoId) : undefined;
  const mercado =
    quote?.historial
      ?.filter((p) => Number.isFinite(p.precioEUR) && p.precioEUR > 0 && Number.isFinite(Date.parse(p.fecha)))
      .map((p) => ({ fecha: p.fecha, valor: p.precioEUR })) ?? [];
  const diario = new Map<string, { fecha: string; valor: number }>();
  for (const h of historial) {
    const v = elegido ? h.valores[elegido.id] : h.total;
    if (v !== undefined) diario.set(h.fecha.slice(0, 10), { fecha: h.fecha.slice(0, 10), valor: v / 100 });
  }
  const verPrecio = !!elegido && modo === 'precio' && mercado.length > 0;
  const data = verPrecio ? mercado : [...diario.values()];
  const reparto = config.inversiones.tipos
    .map((t) => ({
      id: t.id,
      nombre: t.nombre,
      importe: inversiones.filter((v) => v.tipo === t.id).reduce((s, v) => s + valorInversion(v), 0),
      color: COLORES_INVERSION[t.id],
    }))
    .filter((p) => p.importe > 0);
  const antiguas = inversiones.filter((i) => precioAntiguo(i.precioFecha)).length;
  const automaticasSinPrecio = inversiones.filter(
    (i) => i.activoId && !cotizaciones.some((q) => q.id === i.activoId),
  ).length;
  return (
    <>
      <PageHeader
        titulo="Inversión"
        subtitulo="Tu patrimonio invertido, con perspectiva."
        acciones={
          <>
            <button className="btn btn-secondary" disabled={busy} onClick={() => void actualizar(undefined, true)}>
              {busy ? 'Consultando…' : 'Actualizar precios'}
            </button>
            <button className="btn btn-primary" onClick={() => setForm({})}>
              <Icon name="mas" size={16} />
              Añadir inversión
            </button>
          </>
        }
      />
      <div className="stack">
        {error && (
          <div className="finance-notice" role="alert">
            {error}
          </div>
        )}
        <section className="recurring-summary portfolio-summary">
          <div>
            <span className="summary-icon">
              <Icon name="inversion" size={20} />
            </span>
            <span>Lo que vale tu cartera</span>
            <strong>{formatMoney(total)}</strong>
            <small>
              {inversiones.length} {inversiones.length === 1 ? 'inversión' : 'inversiones'} · todo en euros
            </small>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="efectivo" size={20} />
            </span>
            <span>Lo que pusiste</span>
            <strong>{formatMoney(coste)}</strong>
            <small>Coste de compra, con comisiones</small>
          </div>
          <div>
            <span className={`summary-icon ${total >= coste ? 'income-text' : 'expense-text'}`}>
              <Icon name={total >= coste ? 'ingreso' : 'gasto'} size={20} />
            </span>
            <span>{total === coste ? 'Sin cambios' : total > coste ? 'Has ganado' : 'Has perdido'}</span>
            <strong className={total === coste ? undefined : total > coste ? 'income-text' : 'expense-text'}>
              {formatMoney(Math.abs(total - coste))}
            </strong>
            <small>
              {coste > 0 ? (
                <span className={`gain-chip ${total >= coste ? 'is-up' : 'is-down'}`}>
                  {total >= coste ? '+' : '−'}
                  {((Math.abs(total - coste) / coste) * 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} %
                </span>
              ) : (
                'Añade el coste de compra para comparar'
              )}
            </small>
          </div>
        </section>
        {(antiguas > 0 || (!busy && automaticasSinPrecio > 0)) && (
          <div className="finance-notice">
            {antiguas > 0 &&
              `${antiguas} posiciones tienen precios anteriores a ${config.inversiones.antiguedadAvisoHoras} horas. `}
            {!busy &&
              automaticasSinPrecio > 0 &&
              `${automaticasSinPrecio} posiciones conservan el precio guardado porque no hay una cotización disponible en el catálogo. `}
            Consulta la fecha y la fuente antes de interpretar el total.
          </div>
        )}
        <div className="portfolio-breakdown">
          <section className="card holdings-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Qué tienes y cuánto vale</h2>
                <div className="card-sub">Valor actual = unidades que tienes × precio por unidad</div>
              </div>
              <select
                className="select finance-select"
                aria-label="Filtrar tipo de inversión"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              >
                <option value="">Todos los activos</option>
                {config.inversiones.tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            {!inversiones.length ? (
              <div className="empty">
                <div className="empty-title">Empieza a reunir tus inversiones</div>
                <div>
                  Añade cripto, divisas, acciones, fondos u otros activos. Sus precios y cantidades se guardan en tu
                  navegador.
                </div>
                <button className="btn btn-secondary" onClick={() => setForm({})}>
                  Añadir la primera
                </button>
              </div>
            ) : !inversiones.some((i) => !filtro || i.tipo === filtro) ? (
              <div className="empty">No hay posiciones de este tipo.</div>
            ) : (
              <div className="list holdings-list">
                <div className="holdings-labels">
                  <span>Inversión</span>
                  <span>Pagaste</span>
                  <span>Vale ahora</span>
                  <span>Subida / bajada</span>
                </div>
                {inversiones
                  .filter((i) => !filtro || i.tipo === filtro)
                  .map((i) => (
                    <div key={i.id} className="investment-row">
                      <button
                        className="finance-row-main"
                        onClick={() => {
                          setSeleccion(i.id);
                          setModo('valor');
                          document.querySelector('.value-chart')?.scrollIntoView({ block: 'center' });
                        }}
                      >
                        <CategoryIcon icono={ICONO_TIPO[i.tipo] ?? 'inversion'} color={COLORES_INVERSION[i.tipo]} />
                        <span>
                          <strong>{i.nombre}</strong>
                          <span className="row-sub">
                            {i.cantidad.toLocaleString('es-ES', { maximumFractionDigits: 12 })} unidades ×{' '}
                            {formatEuros(i.precioEUR, 6)} · {i.activoId ? 'Cotización periódica' : 'Manual'}
                          </span>
                          <span className="quote-source">
                            {fechaPrecio(i.precioFecha)} · {i.fuente}
                          </span>
                        </span>
                        <span className="holding-numbers">
                          <span>
                            <small>Pagaste</small>
                            {formatMoney(i.coste)}
                          </span>
                          <span>
                            <small>Vale ahora</small>
                            <strong>{formatMoney(valorInversion(i))}</strong>
                          </span>
                          <span
                            className={
                              valorInversion(i) === i.coste
                                ? undefined
                                : valorInversion(i) > i.coste
                                  ? 'income-text'
                                  : 'expense-text'
                            }
                          >
                            <small>
                              {valorInversion(i) === i.coste
                                ? 'Sin cambios'
                                : valorInversion(i) > i.coste
                                  ? 'Ha subido'
                                  : 'Ha bajado'}
                            </small>
                            {formatMoney(valorInversion(i) - i.coste, { signo: 'siempre' })}
                          </span>
                        </span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        aria-label={`Editar ${i.nombre}`}
                        onClick={() => setForm({ actual: i })}
                      >
                        Editar
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </section>
          <aside className="card allocation-card">
            <h2 className="card-title">Cómo se reparte</h2>
            <p className="card-sub">Por tipo de inversión, según su valor actual.</p>
            {reparto.length ? (
              <Donut porciones={reparto} titulo="Reparto de mi cartera" />
            ) : (
              <div className="empty">Tu distribución aparecerá al añadir inversiones.</div>
            )}
            <p className="field-hint">
              La subida o bajada compara con el coste que registraste. No incluye ventas, dividendos ni impuestos.
            </p>
          </aside>
        </div>
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                {elegido ? `Tu inversión en ${elegido.nombre}` : 'Cómo cambia el valor de tu cartera'}
              </h2>
              <div className="card-sub">
                {verPrecio
                  ? 'Precio de una unidad del activo · no es el valor de tu inversión'
                  : 'Lo que valen tus unidades · valores guardados al usar Neto'}
              </div>
            </div>
            <select
              className="select finance-select"
              aria-label="Ver evolución de"
              value={elegido?.id ?? ''}
              onChange={(e) => {
                setSeleccion(e.target.value);
                setModo('valor');
              }}
            >
              <option value="">Toda la cartera</option>
              {inversiones.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </div>
          {elegido && mercado.length > 0 && (
            <div className="portfolio-modes">
              <button
                className="btn btn-secondary btn-sm"
                aria-pressed={modo === 'valor'}
                onClick={() => setModo('valor')}
              >
                Valor de mi inversión
              </button>
              <button
                className="btn btn-secondary btn-sm"
                aria-pressed={modo === 'precio'}
                onClick={() => setModo('precio')}
              >
                Precio de una unidad
              </button>
            </div>
          )}
          <ValueChart
            key={seleccion + modo}
            datos={data}
            etiqueta={elegido?.nombre ?? 'la cartera'}
            precio={verPrecio}
          />
          <p className="field-hint">
            {verPrecio
              ? `Histórico disponible de mercado, independiente de cuándo compraste. Fuente: ${quote?.fuente}.`
              : 'El histórico empieza al registrar tus posiciones y guarda la última valoración de cada día. Incluye cambios de cantidad, altas y bajas; no representa una rentabilidad ajustada por aportaciones.'}
          </p>
        </section>
        <p className="field-hint">
          Precios publicados aproximadamente cada 6 horas, sujetos a disponibilidad y horario del mercado. Las divisas
          usan el último cambio de referencia del BCE; las acciones en otra moneda se convierten a euros. Las posiciones
          manuales se actualizan al editar su valoración. No se envían tus posiciones a los proveedores.
        </p>
      </div>
      {form && <Formulario actual={form.actual} cotizaciones={cotizaciones} cerrar={() => setForm(null)} />}
    </>
  );
}
