import { useState } from 'react';
import {
  useAjustes,
  useCategorias,
  useCuentas,
  useMovimientos,
  useMetas,
  useAportesMetas,
  usePresupuestos,
  usePagosFijos,
  useSuscripciones,
  useHoy,
} from '../db/hooks';
import { dineroDisponible, saldosPorCuenta } from '../lib/balances';
import { dineroMeta } from '../lib/goalMoney';
import { monthKey, shortDate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { gastosPresupuesto, resumenPresupuestos } from '../lib/budgets';
import { fichasRecurrentes, recurrentesPendientes, type Ficha } from '../lib/recurring';
import { FormPago } from '../screens/Recurrentes';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { RecurrenteIcon } from './RecurrenteIcon';
import { ServiceIcon } from './ServiceIcon';

export function AvailableDetails({ cerrar }: { cerrar: () => void }) {
  const cuentas = useCuentas(),
    movimientos = useMovimientos(),
    metas = useMetas(),
    aportes = useAportesMetas();
  const hoy = useHoy(),
    presupuestos = usePresupuestos(monthKey(hoy));
  const saldos = saldosPorCuenta(cuentas, movimientos),
    dinero = dineroDisponible(cuentas, movimientos);
  const plan = resumenPresupuestos(presupuestos, gastosPresupuesto(movimientos, cuentas, monthKey(hoy), hoy));
  const uso = cuentas.filter(
    (c) => c.ambito === 'personal' && !c.eliminada && !c.archivada && !c.cuentaPadreId && c.tipo !== 'ahorro',
  );
  return (
    <Modal titulo="De dónde sale tu disponible" onClose={cerrar}>
      <div className="modal-body available-detail">
        <div className="detail-highlight">
          <span>Disponible para gastar hoy</span>
          <strong>{formatMoney(dinero.disponible)}</strong>
          <p>Es la suma del saldo actual de tus cuentas de uso. El ahorro de tus metas queda separado.</p>
        </div>
        <h3>Tus cuentas de uso</h3>
        <dl className="finance-breakdown">
          {uso.map((c) => (
            <div key={c.id}>
              <dt>{c.nombre}</dt>
              <dd>{formatMoney(saldos.get(c.id) ?? 0)}</dd>
            </div>
          ))}
        </dl>
        <h3>Ahorro en tus metas · {formatMoney(dinero.ahorro)}</h3>
        <dl className="finance-breakdown">
          {metas
            .filter((m) => m.cuentaAhorroId)
            .map((m) => (
              <div key={m.id}>
                <dt>{m.nombre}</dt>
                <dd>{formatMoney(dineroMeta(m, aportes, cuentas, movimientos).disponible)}</dd>
              </div>
            ))}
        </dl>
        <a className="text-link" href="#/metas" onClick={cerrar}>
          Ver el detalle de mis metas <Icon name="flecha" size={16} />
        </a>
        <div className="detail-highlight">
          <span>Margen de tus presupuestos de este mes</span>
          <strong>{presupuestos.length ? formatMoney(plan.restante) : 'Sin límites definidos'}</strong>
          <p>
            Es lo que queda de tus límites, después de los gastos registrados en esas categorías. No es otro saldo
            bancario ni dinero adicional.
          </p>
          <a className="text-link" href="#/presupuestos" onClick={cerrar}>
            Revisar presupuestos <Icon name="flecha" size={16} />
          </a>
        </div>
        <p className="field-hint">
          Los recordatorios de pagos e ingresos no modifican estas cifras hasta que confirmes que han ocurrido. Las
          inversiones se consultan por separado.
        </p>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={cerrar}>
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function HomeRecurring() {
  const hoy = useHoy(),
    fijos = usePagosFijos(),
    subs = useSuscripciones(),
    cats = useCategorias();
  const [pago, setPago] = useState<Ficha | null>(null);
  const pendientes = recurrentesPendientes(fichasRecurrentes(fijos, subs, cats), hoy);
  if (!pendientes.length && !pago) return null;
  return (
    <section className="card home-reminders" aria-label="Pagos e ingresos por confirmar">
      <div className="card-header">
        <div>
          <span className="eyebrow">A mano, cuando toca</span>
          <h2 className="card-title">
            Tienes {pendientes.length} {pendientes.length === 1 ? 'recordatorio' : 'recordatorios'}
          </h2>
          <p className="card-sub">Confirma solo los cargos o ingresos que ya se hayan realizado.</p>
        </div>
        <a className="btn btn-ghost btn-sm" href="#/recurrentes">
          Ver recurrentes
        </a>
      </div>
      <div className="home-reminder-list">
        {pendientes.map((f) => (
          <article className="home-reminder" key={f.origen + f.id} aria-label={`Recordatorio ${f.nombre}`}>
            {f.origen === 'suscripcion' ? (
              <ServiceIcon id={f.servicioId} nombre={f.nombre} />
            ) : (
              <RecurrenteIcon
                nombre={f.nombre}
                tipo={f.tipo === 'ingreso' ? 'ingreso' : 'gasto'}
                categoriaId={(f as { categoriaId?: string }).categoriaId}
              />
            )}
            <div className="reminder-name">
              <strong>{f.nombre}</strong>
              <small>
                {f.proximaFecha === hoy ? 'Hoy' : `Pendiente desde el ${shortDate(f.proximaFecha, hoy)}`} ·{' '}
                {f.tipo === 'ingreso' ? '¿Ya lo has recibido?' : '¿Ya se ha cobrado?'}
              </small>
            </div>
            <b>{formatMoney(f.importe)}</b>
            <button
              className="btn btn-primary"
              aria-label={`${f.tipo === 'gasto' ? 'Pagado' : 'Cobrado'} ${f.nombre}`}
              onClick={() => setPago(f)}
            >
              <Icon name="check" size={16} />
              {f.tipo === 'gasto' ? 'Pagado' : 'Cobrado'}
            </button>
          </article>
        ))}
      </div>
      {pago && <FormPago item={pago} cerrar={() => setPago(null)} />}
    </section>
  );
}

export function BackupReminder() {
  const ajustes = useAjustes(),
    movimientos = useMovimientos(),
    hoy = useHoy(),
    [oculto, setOculto] = useState(false);
  if (
    oculto ||
    !movimientos.length ||
    (ajustes?.ultimaCopiaEn && Date.parse(hoy) - Date.parse(ajustes.ultimaCopiaEn) < 30 * 86400000)
  )
    return null;
  return (
    <aside className="backup-reminder">
      <Icon name="descargar" size={20} />
      <div>
        <strong>
          {ajustes?.ultimaCopiaEn
            ? 'Hace más de un mes que no guardas una copia'
            : 'Guarda tu primera copia de seguridad'}
        </strong>
        <p>Tus datos están en este navegador. Puedes guardar y restaurar una copia desde Ajustes.</p>
      </div>
      <a className="btn btn-secondary btn-sm" href="#/ajustes">
        Guardar copia
      </a>
      <button
        className="btn btn-ghost btn-icon"
        aria-label="Ocultar recordatorio de copia"
        onClick={() => setOculto(true)}
      >
        ×
      </button>
    </aside>
  );
}
