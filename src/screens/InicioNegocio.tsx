import { useMemo, useState } from 'react';
import { PageHeader } from '../layout/Shell';
import { useAjustes, useCuentas, useFacturas, useGastosNegocio, useMapaCategorias, useMovimientos } from '../db/hooks';
import { resumirGastos } from '../lib/gastosNegocio';
import { GastoNegocioForm } from '../ui/GastoNegocioForm';
import type { Factura, TipoMovimiento } from '../db/types';
import { patrimonio, esRepartoInterno } from '../lib/balances';
import { longDate, shortDate, todayISO } from '../lib/dates';
import {
  enTrimestre,
  estadoFactura,
  nombreTrimestre,
  perfilNegocio,
  resumirFacturas,
  totalesFactura,
  trimestreDe,
} from '../lib/facturas';
import { formatMoney } from '../lib/money';
import { diasHasta, siguientePlazo } from '../lib/plazos';
import { exentoDel130, modelo130, modelo303 } from '../lib/impuestos';
import { contar } from '../lib/plural';
import { ordenarMovimientos } from '../lib/stats';
import { CobroForm } from '../ui/CobroForm';
import { CuentaForm } from '../ui/CuentaForm';
import { FacturaForm } from '../ui/FacturaForm';
import { Icon } from '../ui/Icon';
import { MovimientoForm } from '../ui/MovimientoForm';
import { MovimientoRow } from '../ui/MovimientoRow';

const MAX_POR_COBRAR = 4;
const MAX_MOVIMIENTOS = 5;

/** Inicio del espacio Negocio: solo dinero, facturas y plazos del negocio. */
export function InicioNegocio() {
  const ajustes = useAjustes();
  const todasCuentas = useCuentas();
  const movimientos = useMovimientos();
  const facturas = useFacturas();
  const categorias = useMapaCategorias();
  const hoy = todayISO();
  const perfil = perfilNegocio(ajustes?.negocio);
  const [form, setForm] = useState<{ tipo: TipoMovimiento; destino?: string } | null>(null);
  const [factura, setFactura] = useState(false);
  const [cobro, setCobro] = useState<Factura | null>(null);
  const [nuevaCuenta, setNuevaCuenta] = useState(false);
  const [gasto, setGasto] = useState(false);
  const gastos = useGastosNegocio();

  const mapaCuentas = useMemo(() => new Map(todasCuentas.map((c) => [c.id, c])), [todasCuentas]);
  const cuentas = todasCuentas.filter(
    (c) => c.ambito === 'negocio' && !c.eliminada && !c.archivada && !c.cuentaPadreId,
  );
  const personales = todasCuentas.filter(
    (c) => c.ambito === 'personal' && !c.eliminada && !c.archivada && !c.cuentaPadreId && !c.ahorroGeneral,
  );
  const total = patrimonio(todasCuentas, movimientos, 'negocio');

  const trimestre = trimestreDe(hoy);
  const delTrimestre = facturas.filter((f) => enTrimestre(f.fecha, trimestre));
  const resumen = resumirFacturas(delTrimestre);
  const ivaTrimestre =
    perfil.regimenIVA === 'caja'
      ? resumirFacturas(facturas.filter((f) => f.cobradaEn && enTrimestre(f.cobradaEn, trimestre))).iva
      : resumen.iva;
  const gastosTrimestre = resumirGastos(gastos.filter((g) => enTrimestre(g.fecha, trimestre)));
  const pendientes = [...facturas.filter((f) => !f.cobradaEn)].sort((a, b) =>
    a.vencimiento.localeCompare(b.vencimiento),
  );
  const porCobrar = resumirFacturas(pendientes);
  const vencidas = pendientes.filter((f) => estadoFactura(f, hoy) === 'vencida').length;

  const plazo = siguientePlazo(hoy);
  const qPlazo = { anio: plazo.anio, t: plazo.trimestre };
  const aPagar =
    Math.max(0, modelo303(facturas, gastos, qPlazo, perfil).resultado) +
    (exentoDel130(facturas, plazo.anio) ? 0 : modelo130(facturas, gastos, qPlazo, perfil).resultado);
  const faltan = diasHasta(hoy, plazo.fin);
  const abierto = hoy >= plazo.inicio;

  const recientes = ordenarMovimientos(
    movimientos.filter(
      (m) =>
        m.fecha <= hoy &&
        [m.cuentaId, m.cuentaDestinoId].some((id) => id && mapaCuentas.get(id)?.ambito === 'negocio') &&
        !esRepartoInterno(m, mapaCuentas),
    ),
  ).slice(0, MAX_MOVIMIENTOS);

  const fechaTexto = longDate(hoy);

  return (
    <>
      <PageHeader
        titulo="Tu negocio"
        subtitulo={fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}
        acciones={
          <button className="btn btn-primary" onClick={() => setFactura(true)}>
            <Icon name="mas" size={16} stroke={2.2} />
            Registrar factura
          </button>
        }
      />

      {cuentas.length === 0 && (
        <div className="card business-start">
          <span className="business-start-icon" aria-hidden="true">
            <Icon name="negocio" size={22} />
          </span>
          <div>
            <h2 className="card-title">Añade la cuenta del negocio</h2>
            <p className="muted">
              Es donde cobras tus facturas y pagas los gastos del negocio. Así su dinero no se mezcla con el tuyo.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setNuevaCuenta(true)}>
            Añadir cuenta
          </button>
        </div>
      )}

      <div className="stack">
        <div className="overview-grid">
          <section className="available-money hero-dark business-hero">
            <div className="available-main">
              <span className="eyebrow">Dinero del negocio</span>
              <strong>{formatMoney(total)}</strong>
              <small>
                {cuentas.length === 0
                  ? 'Todavía sin cuentas del negocio.'
                  : cuentas.length === 1
                    ? `En ${cuentas[0].nombre}.`
                    : `Repartido en ${contar(cuentas.length, 'cuenta', 'cuentas')}.`}
              </small>
              <a className="available-explain text-link" href="#/negocio-cuentas">
                Ver cuentas <Icon name="derecha" size={15} />
              </a>
            </div>
            <div className="available-savings">
              <span className="savings-symbol">
                <Icon name={vencidas ? 'alerta' : 'cobrar'} size={22} />
              </span>
              <span>Pendiente de cobro</span>
              <b>{formatMoney(porCobrar.total)}</b>
              <small>
                {porCobrar.facturas === 0
                  ? 'Todas tus facturas están cobradas.'
                  : `${contar(porCobrar.facturas, 'factura', 'facturas')}${vencidas ? `, ${contar(vencidas, 'vencida', 'vencidas')}` : ''}.`}
              </small>
            </div>
            <div className="quick-movements" aria-label="Registrar en el negocio">
              <button className="quick-movement is-accent" onClick={() => setFactura(true)}>
                <span>
                  <Icon name="facturas" />
                </span>
                <strong>Factura</strong>
                <Icon name="mas" size={18} />
              </button>
              <button className="quick-movement" onClick={() => setGasto(true)}>
                <span className="expense-text">
                  <Icon name="gasto" />
                </span>
                <strong>Gasto</strong>
                <Icon name="mas" size={18} />
              </button>
              <button
                className="quick-movement"
                onClick={() => setForm({ tipo: 'transferencia', destino: personales[0]?.id })}
                disabled={!cuentas.length || !personales.length}
              >
                <span>
                  <Icon name="transferencia" />
                </span>
                <strong>Me pago a mí</strong>
                <Icon name="flecha" size={18} />
              </button>
            </div>
            <p>
              <Icon name="check" size={15} />
              Solo el negocio. Lo personal está en su propio espacio.
            </p>
          </section>

          <section className="card business-deadline" aria-labelledby="proximo-plazo">
            <div className="hero-heading">
              <span className="eyebrow" id="proximo-plazo">
                Próximo plazo de impuestos
              </span>
              <span className="glass-icon">
                <Icon name="impuestos" size={21} />
              </span>
            </div>
            <div className="business-deadline-date">
              <strong>{longDate(plazo.fin, true).replace(/^./, (c) => c.toUpperCase())}</strong>
              <span className={`business-deadline-left${faltan <= 7 ? ' is-soon' : ''}`}>
                {faltan === 0 ? 'Termina hoy' : faltan === 1 ? 'Queda 1 día' : `Quedan ${faltan} días`}
              </span>
            </div>
            <div className="business-deadline-amount">
              <span>Estimado a pagar</span>
              <strong>{formatMoney(aPagar)}</strong>
            </div>
            <p className="muted">
              IVA (modelo 303) y pago de IRPF (modelo 130) del{' '}
              {nombreTrimestre({ anio: plazo.anio, t: plazo.trimestre })}.{' '}
              {abierto ? 'El plazo ya está abierto.' : `Se puede presentar desde el ${longDate(plazo.inicio)}.`}
              {plazo.movido ? ' El último día caía en fin de semana y pasa al lunes.' : ''}
            </p>
            <a className="business-deadline-link" href="#/impuestos">
              Ver impuestos <Icon name="flecha" size={18} />
            </a>
          </section>
        </div>

        <section className="recurring-summary invoice-summary" aria-label={`Resumen del ${nombreTrimestre(trimestre)}`}>
          <div>
            <span className="summary-icon">
              <Icon name="facturas" size={20} />
            </span>
            <span>Facturado este trimestre</span>
            <strong>{formatMoney(resumen.base)}</strong>
            <small>
              {contar(resumen.facturas, 'factura', 'facturas')} · sin IVA
              {resumen.retencion > 0 ? ` · ${formatMoney(resumen.retencion)} retenidos` : ''}
            </small>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="gastos" size={20} />
            </span>
            <span>Gastos deducibles</span>
            <strong>{formatMoney(gastosTrimestre.gastoIRPF)}</strong>
            <small>
              <a className="text-link" href="#/gastos">
                {contar(gastosTrimestre.gastos, 'gasto', 'gastos')} este trimestre
              </a>
            </small>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="impuestos" size={20} />
            </span>
            <span>IVA del trimestre</span>
            <strong>{formatMoney(ivaTrimestre - gastosTrimestre.ivaDeducible)}</strong>
            <small>
              {formatMoney(ivaTrimestre)} cobrado − {formatMoney(gastosTrimestre.ivaDeducible)} de tus gastos.{' '}
              {ivaTrimestre - gastosTrimestre.ivaDeducible < 0
                ? 'A tu favor: se compensa más adelante.'
                : 'No es tuyo: es para Hacienda.'}
            </small>
          </div>
        </section>

        <div className="grid grid-2 business-lists">
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Por cobrar</h2>
              <a className="text-link" href="#/facturas">
                Ver facturas
              </a>
            </div>
            {pendientes.length === 0 ? (
              <div className="empty">
                <div className="empty-title">Nada pendiente</div>
                <div>Cuando registres una factura, aquí verás si te la han pagado.</div>
              </div>
            ) : (
              <ul className="invoice-list">
                {pendientes.slice(0, MAX_POR_COBRAR).map((f) => {
                  const estado = estadoFactura(f, hoy);
                  return (
                    <li key={f.id} className={`invoice-row is-${estado}`}>
                      <a className="invoice-row-main" href="#/facturas">
                        <span className="invoice-row-text">
                          <span className="invoice-row-title">
                            <strong>{f.clienteNombre}</strong>
                            <span className="faint">{f.numero}</span>
                          </span>
                          <span className={`invoice-status is-${estado}`}>
                            {estado === 'vencida'
                              ? `Vencida ${shortDate(f.vencimiento, hoy)}`
                              : `Vence ${shortDate(f.vencimiento, hoy)}`}
                          </span>
                        </span>
                        <span className="invoice-row-amount">
                          <strong>{formatMoney(totalesFactura(f.lineas, f.retencion).total)}</strong>
                        </span>
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm invoice-row-collect"
                        onClick={() => setCobro(f)}
                      >
                        <Icon name="check" size={16} />
                        Cobrada
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Últimos movimientos</h2>
              <a className="text-link" href="#/negocio-movimientos">
                Ver todos
              </a>
            </div>
            {recientes.length === 0 ? (
              <div className="empty">
                <div className="empty-title">Sin movimientos todavía</div>
                <div>Los cobros de facturas y los gastos del negocio aparecerán aquí.</div>
              </div>
            ) : (
              <div className="list">
                {recientes.map((m) => (
                  <MovimientoRow key={m.id} m={m} categorias={categorias} cuentas={mapaCuentas} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {form && (
        <MovimientoForm
          tipoInicial={form.tipo}
          destinoPreferido={form.destino}
          cuentaPreferida={cuentas.some((c) => c.id === form.destino) ? undefined : cuentas[0]?.id}
          onClose={() => setForm(null)}
        />
      )}
      {factura && <FacturaForm onClose={() => setFactura(false)} />}
      {gasto && <GastoNegocioForm onClose={() => setGasto(false)} />}
      {cobro && <CobroForm factura={cobro} onClose={() => setCobro(null)} />}
      {nuevaCuenta && <CuentaForm ambitoInicial="negocio" onClose={() => setNuevaCuenta(false)} />}
    </>
  );
}
