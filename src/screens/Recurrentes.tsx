import { useCategoriasEspacio } from '../ui/Espacio';
import { useState } from 'react';
import { useCuentas, useMovimientos, usePagosFijos, usePagosRegistrados, useSuscripciones } from '../db/hooks';
import type { PagoFijo, Suscripcion } from '../db/types';
import { db } from '../db/db';
import { guardarPagoFijo, registrarPago, omitirPeriodo, deshacerPago } from '../db/recurring';
import { config } from '../config/neto.config';
import { todayISO, shortDate, monthKey } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { SERVICIOS } from '../lib/services';
import { PageHeader } from '../layout/Shell';
import { AmountInput, useAmountField } from '../ui/AmountInput';
import { Modal, useConfirm, useToast } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { costeAnual, costeMensual } from '../lib/subscriptions';
import { RecurrenteIcon } from '../ui/RecurrenteIcon';
import { ServiceIcon } from '../ui/ServiceIcon';
import { FormularioSuscripcion } from './Suscripciones';
import { MovimientoForm } from '../ui/MovimientoForm';
import type { Movimiento } from '../db/types';
import { fichasRecurrentes, type Ficha } from '../lib/recurring';
function FormFijo({ actual, tipo, cerrar }: { actual?: PagoFijo; tipo: 'gasto' | 'ingreso'; cerrar: () => void }) {
  const cuentas = useCuentas().filter(
    (c) => !c.eliminada && !c.archivada && !c.cuentaPadreId && !c.ahorroGeneral && c.ambito === 'personal',
  );
  const categorias = useCategoriasEspacio().filter((c) => c.tipo === tipo);
  const confirmar = useConfirm();
  const [nombre, setNombre] = useState(actual?.nombre ?? '');
  const importe = useAmountField(actual?.importe);
  const [cuenta, setCuenta] = useState(actual?.cuentaId ?? '');
  const [categoria, setCategoria] = useState(actual?.categoriaId ?? '');
  const [periodo, setPeriodo] = useState<Suscripcion['periodo']>(actual?.periodo ?? 'mensual');
  const [fecha, setFecha] = useState(actual?.proximaFecha ?? todayISO());
  const [activo, setActivo] = useState(actual?.activo ?? true);
  // Las fichas nuevas se apuntan solas; las que ya existían siguen como estaban.
  const [automatico, setAutomatico] = useState(actual ? !!actual.automatico : true);
  const [nota, setNota] = useState(actual?.nota ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      titulo={actual ? 'Editar recurrente' : tipo === 'gasto' ? 'Nuevo pago fijo' : 'Nuevo ingreso recurrente'}
      onClose={cerrar}
    >
      <form
        className="modal-body"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            await guardarPagoFijo(
              {
                nombre,
                tipo,
                importe: importe.cents ?? 0,
                cuentaId: (cuentas.some((c) => c.id === cuenta) ? cuenta : cuentas[0]?.id) || '',
                categoriaId: (categorias.some((c) => c.id === categoria) ? categoria : categorias[0]?.id) || '',
                periodo,
                proximaFecha: fecha,
                diaCobro: actual && fecha === actual.proximaFecha ? actual.diaCobro : Number(fecha.slice(-2)),
                activo,
                automatico,
                nota,
              },
              actual?.id,
            );
            cerrar();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="fixed-name">
            Nombre
          </label>
          <input
            id="fixed-name"
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
            required
            placeholder={tipo === 'gasto' ? 'Alquiler, luz, gimnasio…' : 'Nómina, alquiler cobrado…'}
            data-autofocus
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="fixed-amount">
              Importe de referencia
            </label>
            <AmountInput id="fixed-amount" texto={importe.texto} onChange={importe.setTexto} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="fixed-period">
              Periodicidad
            </label>
            <select
              id="fixed-period"
              className="select"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Suscripcion['periodo'])}
            >
              {config.suscripciones.periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="fixed-account">
              Cuenta
            </label>
            <select
              id="fixed-account"
              className="select"
              value={(cuentas.some((c) => c.id === cuenta) ? cuenta : cuentas[0]?.id) || ''}
              onChange={(e) => setCuenta(e.target.value)}
            >
              {cuentas.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="fixed-category">
              Categoría
            </label>
            <select
              id="fixed-category"
              className="select"
              value={(categorias.some((c) => c.id === categoria) ? categoria : categorias[0]?.id) || ''}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {categorias.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="fixed-date">
            Fecha de referencia del periodo
          </label>
          <input
            type="date"
            id="fixed-date"
            className="input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
          <span className="field-hint">
            Solo organiza la ficha. No se registra dinero hasta que confirmes «{tipo === 'gasto' ? 'Pagado' : 'Cobrado'}
            ».
          </span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="fixed-note">
            Notas
          </label>
          <input
            id="fixed-note"
            className="input"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={250}
          />
        </div>
        <label className="goal-check">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Ficha activa
        </label>
        <label className="goal-check">
          <input type="checkbox" checked={automatico} onChange={(e) => setAutomatico(e.target.checked)} />
          Apuntar automáticamente cada periodo
        </label>
        <p className="field-hint">
          {automatico
            ? 'Se apunta solo el día que toca, con este importe. Si un mes cambia (la luz, por ejemplo), corrígelo en Movimientos.'
            : 'Neto te avisará el día que toca y tú confirmas el importe real con «Pagado» o «Cobrado».'}
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          {actual && (
            <button
              type="button"
              className="btn btn-ghost left"
              onClick={async () => {
                if (
                  await confirmar({
                    titulo: 'Eliminar recurrente',
                    mensaje: 'Se eliminará la ficha. Sus pagos y movimientos ya registrados se conservarán.',
                    confirmar: 'Eliminar',
                    peligro: true,
                  })
                ) {
                  await db.pagosFijos.delete(actual.id);
                  cerrar();
                }
              }}
            >
              Eliminar
            </button>
          )}
          <button className="btn btn-ghost" type="button" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy || !cuentas.length || !categorias.length}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function FormPago({ item, cerrar }: { item: Ficha; cerrar: () => void }) {
  const cuentas = useCuentas().filter(
    (c) => !c.eliminada && !c.archivada && !c.cuentaPadreId && !c.ahorroGeneral && c.ambito === 'personal',
  );
  const categorias = useCategoriasEspacio().filter((c) => c.tipo === item.tipo);
  const avisar = useToast();
  const confirmar = useConfirm();
  const importe = useAmountField(item.importe);
  const [fecha, setFecha] = useState(todayISO());
  const [cuenta, setCuenta] = useState(item.cuentaId ?? '');
  const [categoria, setCategoria] = useState(item.categoriaId ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal titulo={`${item.tipo === 'gasto' ? 'Marcar pagado' : 'Marcar cobrado'} · ${item.nombre}`} onClose={cerrar}>
      <form
        className="modal-body"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            await registrarPago({
              origen: item.origen,
              recurrenteId: item.id,
              periodoFecha: item.proximaFecha,
              fecha,
              importe: importe.cents ?? 0,
              cuentaId: (cuentas.some((c) => c.id === cuenta) ? cuenta : cuentas[0]?.id) || '',
              categoriaId:
                (categorias.some((c) => c.id === categoria)
                  ? categoria
                  : categorias.find(
                      (c) => c.nombre === (item.origen === 'suscripcion' ? 'Suscripciones' : item.categoria),
                    )?.id) ||
                categorias[0]?.id ||
                '',
            });
            avisar(item.tipo === 'gasto' ? 'Pago registrado' : 'Ingreso registrado');
            cerrar();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo registrar.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Confirma únicamente si el dinero ya se ha {item.tipo === 'gasto' ? 'cargado' : 'ingresado'}. Periodo de
          referencia: {shortDate(item.proximaFecha)}.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="paid-amount">
            Importe real
          </label>
          <AmountInput id="paid-amount" texto={importe.texto} onChange={importe.setTexto} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="paid-date">
            Fecha real
          </label>
          <input
            type="date"
            id="paid-date"
            className="input"
            max={todayISO()}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="paid-account">
              Cuenta del movimiento
            </label>
            <select
              id="paid-account"
              className="select"
              value={(cuentas.some((c) => c.id === cuenta) ? cuenta : cuentas[0]?.id) || ''}
              onChange={(e) => setCuenta(e.target.value)}
            >
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="paid-category">
              Categoría del movimiento
            </label>
            <select
              id="paid-category"
              className="select"
              value={
                (categorias.some((c) => c.id === categoria)
                  ? categoria
                  : categorias.find(
                      (c) => c.nombre === (item.origen === 'suscripcion' ? 'Suscripciones' : item.categoria),
                    )?.id) ||
                categorias[0]?.id ||
                ''
              }
              onChange={(e) => setCategoria(e.target.value)}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="field-hint">
          Se creará un movimiento real y se avanzará el periodo de la ficha en la misma operación.
        </p>
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button
            className="btn btn-ghost left"
            type="button"
            disabled={busy}
            onClick={async () => {
              if (
                !(await confirmar({
                  titulo: 'Omitir este periodo',
                  mensaje:
                    'Se avanzará al siguiente periodo sin registrar dinero. Úsalo solo si este pago o ingreso no se va a realizar.',
                  confirmar: 'Omitir periodo',
                }))
              )
                return;
              setBusy(true);
              try {
                await omitirPeriodo(item.origen, item.id, item.proximaFecha);
                avisar('Periodo omitido sin registrar dinero');
                cerrar();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudo omitir.');
              } finally {
                setBusy(false);
              }
            }}
          >
            No se ha realizado
          </button>
          <button className="btn btn-ghost" type="button" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy || !cuentas.length || !categorias.length}>
            {item.tipo === 'gasto' ? 'Confirmar pago' : 'Confirmar cobro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Recurrentes({ soloSuscripciones = false }: { soloSuscripciones?: boolean }) {
  const fijos = usePagosFijos();
  const subs = useSuscripciones().filter((s) => s.ambito === 'personal');
  // Lo que cuestan tus suscripciones activas, pasado a mes y a año (las anuales cuentan 1/12 al mes).
  const subsActivas = subs.filter((x) => x.estado === 'activa');
  const cats = useCategoriasEspacio();
  const registros = usePagosRegistrados();
  const movimientos = useMovimientos();
  const [tab, setTab] = useState<'gasto' | 'ingreso'>('gasto');
  const [filtro, setFiltro] = useState(soloSuscripciones ? 'suscripcion' : 'todos');
  const [buscar, setBuscar] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [grupoServicios, setGrupoServicios] = useState('Cloud');
  const [soloActivos, setSoloActivos] = useState(true);
  const [form, setForm] = useState<{ actual?: PagoFijo; tipo: 'gasto' | 'ingreso' } | null>(null);
  const [subForm, setSubForm] = useState<{ actual?: Suscripcion; servicioInicial?: string } | null>(null);
  const [pago, setPago] = useState<Ficha | null>(null);
  const [historial, setHistorial] = useState(false);
  const [editarMov, setEditarMov] = useState<Movimiento | null>(null);
  const [catalogo, setCatalogo] = useState(false);
  const fichas = fichasRecurrentes(fijos, subs, cats);
  const confirmar = useConfirm();
  const avisar = useToast();
  const visibles = fichas
    .filter(
      (f) =>
        f.tipo === tab &&
        (!soloActivos || f.activo) &&
        (filtro === 'todos' || f.origen === filtro) &&
        (!categoriaFiltro || f.categoria === categoriaFiltro) &&
        f.nombre.toLocaleLowerCase().includes(buscar.toLocaleLowerCase()),
    )
    .sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha) || a.nombre.localeCompare(b.nombre));
  const mapMov = new Map(movimientos.map((m) => [m.id, m]));
  const realizados = registros.filter(
    (r) => mapMov.has(r.movimientoId) && mapMov.get(r.movimientoId)!.fecha <= todayISO(),
  );
  const esteMes = realizados.filter((r) => monthKey(mapMov.get(r.movimientoId)!.fecha) === monthKey(todayISO()));
  return (
    <>
      <PageHeader
        titulo="Recurrentes"
        subtitulo="Pagos fijos, suscripciones e ingresos. Registra solo lo que ya ha ocurrido."
        acciones={
          <>
            <button className="btn btn-secondary" onClick={() => setSubForm({})}>
              Añadir suscripción
            </button>
            <button className="btn btn-primary" onClick={() => setForm({ tipo: tab })}>
              <Icon name="mas" size={16} />
              {tab === 'gasto' ? 'Nuevo pago fijo' : 'Nuevo ingreso'}
            </button>
          </>
        }
      />
      <div className="stack">
        <section className="recurring-summary">
          <div>
            <span className="summary-icon">
              <Icon name="gasto" size={20} />
            </span>
            <span>Pagado este mes</span>
            <strong>
              {formatMoney(
                esteMes
                  .filter((r) => mapMov.get(r.movimientoId)?.tipo === 'gasto')
                  .reduce((s, r) => s + mapMov.get(r.movimientoId)!.importe, 0),
              )}
            </strong>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="ingreso" size={20} />
            </span>
            <span>Cobrado este mes</span>
            <strong>
              {formatMoney(
                esteMes
                  .filter((r) => mapMov.get(r.movimientoId)?.tipo === 'ingreso')
                  .reduce((s, r) => s + mapMov.get(r.movimientoId)!.importe, 0),
              )}
            </strong>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="suscripciones" size={20} />
            </span>
            <span>Tus suscripciones ({subsActivas.length})</span>
            <strong>{formatMoney(subsActivas.reduce((t, x) => t + costeMensual(x), 0))} al mes</strong>
            <small>
              {formatMoney(subsActivas.reduce((t, x) => t + costeAnual(x), 0))} al año ·{' '}
              {fichas.filter((f) => f.activo).length === 1
                ? '1 ficha activa'
                : `${fichas.filter((f) => f.activo).length} fichas activas`}
            </small>
          </div>
        </section>
        <div className="recurring-tabs">
          <button
            className="btn btn-secondary"
            aria-pressed={tab === 'gasto'}
            onClick={() => {
              setTab('gasto');
              setFiltro('todos');
              setCategoriaFiltro('');
            }}
          >
            Pagos fijos y suscripciones
          </button>
          <button
            className="btn btn-secondary"
            aria-pressed={tab === 'ingreso'}
            onClick={() => {
              setTab('ingreso');
              setFiltro('todos');
              setCategoriaFiltro('');
            }}
          >
            Ingresos recurrentes
          </button>
          <button
            className="btn btn-ghost recurring-history-toggle"
            aria-expanded={historial}
            onClick={() => setHistorial(!historial)}
          >
            <Icon name="movimientos" size={17} />
            Historial de registros
          </button>
        </div>
        <div className="toolbar recurring-filters">
          <input
            className="input input-search"
            aria-label="Buscar recurrentes"
            placeholder="Buscar por nombre"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          {tab === 'gasto' && (
            <select
              className="select"
              aria-label="Tipo de recurrente"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            >
              <option value="todos">Todos los pagos</option>
              <option value="fijo">Solo pagos fijos</option>
              <option value="suscripcion">Solo suscripciones</option>
            </select>
          )}
          <select
            className="select"
            aria-label="Categoría del recurrente"
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {[...new Set(fichas.filter((f) => f.tipo === tab).map((f) => f.categoria))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="goal-check">
            <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
            Solo activos
          </label>
        </div>
        {!visibles.length ? (
          <section className="card empty">
            <h2 className="empty-title">
              {tab === 'gasto' ? 'Organiza tus pagos habituales' : 'Ten tus ingresos habituales a mano'}
            </h2>
            <p>Guarda una ficha y confirma cada cargo o abono cuando se produzca.</p>
          </section>
        ) : (
          <div className="subscription-grid">
            {visibles.map((f) => {
              const ultimo = realizados.find((r) => r.origen === f.origen && r.recurrenteId === f.id);
              return (
                <article className="subscription-card" key={f.origen + f.id} aria-label={`Recurrente ${f.nombre}`}>
                  <div className="subscription-card-heading">
                    {f.origen === 'suscripcion' ? (
                      <ServiceIcon id={f.servicioId} nombre={f.nombre} />
                    ) : (
                      <RecurrenteIcon
                        nombre={f.nombre}
                        tipo={f.tipo === 'ingreso' ? 'ingreso' : 'gasto'}
                        categoriaId={(f as { categoriaId?: string }).categoriaId}
                      />
                    )}
                    <span>
                      <strong>{f.nombre}</strong>
                      <small>
                        {f.origen === 'suscripcion'
                          ? 'Suscripción'
                          : f.tipo === 'ingreso'
                            ? 'Ingreso recurrente'
                            : 'Pago fijo'}{' '}
                        · {f.categoria}
                      </small>
                    </span>
                  </div>
                  <div className="subscription-card-price">
                    <strong>{formatMoney(f.importe)}</strong>
                    <span>/{f.periodo === 'mensual' ? 'mes' : f.periodo === 'anual' ? 'año' : 'trimestre'}</span>
                  </div>
                  <div className="recurring-card-meta">
                    <div className="subscription-card-date">
                      <span>{f.automatico ? 'Se apunta solo el' : 'Periodo por registrar'}</span>
                      <strong>{shortDate(f.proximaFecha)}</strong>
                    </div>
                    {f.automatico && f.activo && (
                      <span className="recurring-auto" title="Se apunta solo el día que toca">
                        <Icon name="recurrentes" size={13} />
                        Automático
                      </span>
                    )}
                    <span className={`subscription-state ${f.activo ? 'state-activa' : 'state-pausada'}`}>
                      <i />
                      {f.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className={`recurring-paid${ultimo ? '' : ' recurring-unpaid'}`}>
                    {ultimo ? (
                      <>
                        <Icon name="check" size={15} />
                        <span>
                          Último {f.tipo === 'gasto' ? 'pago' : 'cobro'}:{' '}
                          {shortDate(mapMov.get(ultimo.movimientoId)!.fecha)} ·{' '}
                          {formatMoney(mapMov.get(ultimo.movimientoId)!.importe)}
                        </span>
                      </>
                    ) : (
                      <span>Sin {f.tipo === 'gasto' ? 'pagos' : 'cobros'} confirmados desde esta ficha.</span>
                    )}
                  </p>
                  <div className="subscription-card-footer">
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label={`Editar ${f.nombre}`}
                      onClick={() =>
                        f.origen === 'suscripcion'
                          ? setSubForm({ actual: subs.find((s) => s.id === f.id) })
                          : setForm({ actual: fijos.find((p) => p.id === f.id), tipo: f.tipo })
                      }
                    >
                      Editar
                    </button>
                    {f.origen === 'fijo' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void db.pagosFijos.update(f.id, { activo: !f.activo })}
                      >
                        {f.activo ? 'Pausar' : 'Reactivar'}
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      disabled={!f.activo}
                      aria-label={`${f.tipo === 'gasto' ? 'Pagado' : 'Cobrado'} ${f.nombre}`}
                      onClick={() => setPago(f)}
                    >
                      <Icon name="check" size={16} />
                      {f.tipo === 'gasto' ? 'Pagado' : 'Cobrado'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {historial && (
          <section className="card">
            <h2 className="card-title">Pagos e ingresos registrados</h2>
            {!realizados.length ? (
              <p className="field-hint">Todavía no has confirmado ningún cargo o abono aquí.</p>
            ) : (
              realizados.slice(0, 30).map((r) => {
                const m = mapMov.get(r.movimientoId)!;
                return (
                  <div className="recurring-history-entry" key={r.id}>
                    <button className="recurring-history" onClick={() => setEditarMov(m)}>
                      <span>
                        {m.nota}
                        <small>{shortDate(m.fecha)}</small>
                      </span>
                      <strong>{formatMoney(m.importe)}</strong>
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label={`Deshacer confirmación de ${m.nota}`}
                      onClick={async () => {
                        if (
                          !(await confirmar({
                            titulo: 'Deshacer confirmación',
                            mensaje:
                              'Se eliminará este movimiento y el periodo volverá a estar pendiente. Los demás pagos se conservarán.',
                            confirmar: 'Deshacer',
                            peligro: true,
                          }))
                        )
                          return;
                        try {
                          await deshacerPago(r.id);
                          avisar('Confirmación deshecha');
                        } catch (e) {
                          avisar(e instanceof Error ? e.message : 'No se pudo deshacer.');
                        }
                      }}
                    >
                      Deshacer
                    </button>
                  </div>
                );
              })
            )}
          </section>
        )}
        <section className="service-catalog">
          <div className="card-header">
            <h2 className="card-title">Catálogo de suscripciones</h2>
            <button className="btn btn-secondary" onClick={() => setCatalogo(!catalogo)}>
              {catalogo ? 'Ocultar catálogo' : 'Elegir servicio'}
            </button>
          </div>
          {!catalogo && (
            <p className="muted catalogo-resumen">
              Netflix, Spotify, Adobe, iCloud… Elige un servicio y Neto pone su icono y su categoría; tú solo escribes
              lo que pagas.
            </p>
          )}
          {catalogo && (
            <>
              <div className="toolbar">
                <select
                  className="select"
                  aria-label="Grupo del catálogo"
                  value={grupoServicios}
                  onChange={(e) => setGrupoServicios(e.target.value)}
                >
                  {[...new Set(SERVICIOS.map((s) => s.grupo))].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="service-shelf">
                {SERVICIOS.filter((s) => s.grupo === grupoServicios).map((s) => (
                  <button key={s.id} className="service-tile" onClick={() => setSubForm({ servicioInicial: s.id })}>
                    <ServiceIcon id={s.id} nombre={s.nombre} />
                    <span>{s.nombre}</span>
                    <Icon name="mas" size={16} />
                  </button>
                ))}
                <button className="service-tile" onClick={() => setSubForm({})}>
                  <Icon name="mas" />
                  <span>Otros</span>
                </button>
              </div>
            </>
          )}
        </section>
      </div>
      {form && <FormFijo {...form} cerrar={() => setForm(null)} />}{' '}
      {subForm && (
        <FormularioSuscripcion
          {...subForm}
          ambito="personal"
          categorias={[...new Set([...config.suscripciones.categorias, ...subs.map((s) => s.categoria)])]}
          cerrar={() => setSubForm(null)}
        />
      )}{' '}
      {pago && <FormPago item={pago} cerrar={() => setPago(null)} />}{' '}
      {editarMov && <MovimientoForm movimiento={editarMov} onClose={() => setEditarMov(null)} />}
    </>
  );
}
