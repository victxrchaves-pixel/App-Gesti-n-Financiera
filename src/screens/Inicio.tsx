import { AvailableDetails, HomeRecurring, BackupReminder } from '../ui/HomeFinance';
import { BudgetReview } from '../ui/BudgetReview';
import { useMemo, useState } from 'react';
import { colorCategoria, config } from '../config/neto.config';
import { useAjustes, useCuentas, useMapaCategorias, useMovimientos, useHoy } from '../db/hooks';
import { patrimonio, dineroDisponible } from '../lib/balances';
import { greeting, longDate, monthKey, monthLabel, monthShortLabel } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { gastoPorCategoria, ordenarMovimientos, resumenMes, ultimosMeses } from '../lib/stats';
import { PageHeader } from '../layout/Shell';
import { LineChart } from '../ui/LineChart';
import { Segmented } from '../ui/Segmented';
import { Donut, type Porcion } from '../ui/Donut';
import { Icon } from '../ui/Icon';
import { MovimientoForm } from '../ui/MovimientoForm';
import { MovimientoRow } from '../ui/MovimientoRow';
import type { Movimiento, TipoMovimiento } from '../db/types';

export function Inicio() {
  const ajustes = useAjustes();
  const cuentas = useCuentas();
  const movimientos = useMovimientos();
  const categorias = useMapaCategorias();
  const [form, setForm] = useState<{ movimiento?: Movimiento; tipo?: TipoMovimiento } | null>(null);

  const [periodo, setPeriodo] = useState<string>(config.inicio.periodoInicial);
  const meses = Number(periodo);
  const hoy = useHoy();
  const [verDisponible, setVerDisponible] = useState(false);
  const mes = monthKey(hoy);
  const ahora = new Date();

  const resumen = useMemo(() => resumenMes(movimientos, cuentas, mes), [movimientos, cuentas, mes]);
  const disponible = dineroDisponible(cuentas, movimientos);
  const total = useMemo(() => patrimonio(cuentas, movimientos, 'personal'), [cuentas, movimientos]);
  const serie = useMemo(() => ultimosMeses(movimientos, cuentas, mes, meses), [movimientos, cuentas, mes, meses]);
  const mapaCuentas = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas]);
  const recientes = useMemo(
    () =>
      ordenarMovimientos(
        movimientos.filter((m) => m.fecha <= hoy && mapaCuentas.get(m.cuentaId)?.ambito === 'personal'),
      ).slice(0, config.inicio.ultimosMovimientos),
    [movimientos, mapaCuentas, hoy],
  );

  const porciones = useMemo<Porcion[]>(() => {
    const lista = gastoPorCategoria(movimientos, cuentas, mes).filter((p) => p.importe > 0);
    const max = config.inicio.maxCategoriasDona;
    const visibles = lista.length > max ? lista.slice(0, max - 1) : lista;
    const resto = lista.slice(visibles.length).reduce((s, x) => s + x.importe, 0);
    const out: Porcion[] = visibles.map((x) => {
      const c = x.categoriaId ? categorias.get(x.categoriaId) : undefined;
      return {
        id: x.categoriaId ?? 'sin',
        nombre: c?.nombre ?? 'Sin categoría',
        color: colorCategoria(c?.color),
        importe: x.importe,
      };
    });
    if (resto > 0) out.push({ id: 'resto', nombre: 'Resto', color: config.colorOtros, importe: resto });
    return out;
  }, [movimientos, cuentas, mes, categorias]);

  const creditos = gastoPorCategoria(movimientos, cuentas, mes).filter((p) => p.importe < 0);
  const cuentasPersonales = cuentas.filter(
    (c) => c.ambito === 'personal' && !c.eliminada && !c.archivada && !c.cuentaPadreId,
  );
  const nombre = ajustes?.nombre ? `, ${ajustes.nombre}` : '';
  const fechaTexto = longDate(hoy);

  return (
    <>
      <PageHeader
        titulo={`${greeting(ahora.getHours())}${nombre}`}
        subtitulo={fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}
        acciones={
          <button className="btn btn-primary" onClick={() => setForm({})}>
            <Icon name="mas" size={16} stroke={2.2} />
            Nuevo movimiento
          </button>
        }
      />

      {cuentasPersonales.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-title">Empieza creando tu primera cuenta</div>
            <div>Añade tu cuenta del banco, tu efectivo o tus ahorros con el saldo que tienen hoy.</div>
            <a className="btn btn-primary" href="#/cuentas">
              Ir a Cuentas
            </a>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="quick-movements" aria-label="Registrar un movimiento">
            <button className="quick-movement" onClick={() => setForm({ tipo: 'gasto' })}>
              <span className="expense-text">
                <Icon name="gasto" />
              </span>
              <strong>Registrar gasto</strong>
              <Icon name="mas" size={18} />
            </button>
            <button className="quick-movement" onClick={() => setForm({ tipo: 'ingreso' })}>
              <span className="income-text">
                <Icon name="ingreso" />
              </span>
              <strong>Registrar ingreso</strong>
              <Icon name="mas" size={18} />
            </button>
            <button className="quick-movement" onClick={() => setForm({ tipo: 'transferencia' })}>
              <Icon name="transferencia" />
              <strong>Transferir</strong>
              <Icon name="flecha" size={18} />
            </button>
          </div>
          <div className="overview-grid">
            <section className="available-money">
              <div className="available-main">
                <span className="eyebrow">Disponible para gastar</span>
                <strong>{formatMoney(disponible.disponible)}</strong>
                <small>Dinero actual en tus cuentas de uso.</small>
                <button className="available-explain text-link" onClick={() => setVerDisponible(true)}>
                  Ver cómo se calcula <Icon name="derecha" size={15} />
                </button>
              </div>
              <div className="available-savings">
                <span className="savings-symbol">
                  <Icon name="ahorro" size={22} />
                </span>
                <span>Ahorro separado</span>
                <b>{formatMoney(disponible.ahorro)}</b>
                <small>Todo tu ahorro, repartido entre tus metas.</small>
              </div>
              <p>
                <Icon name="check" size={15} />
                Solo dinero registrado. Sin anticipar pagos ni ingresos.
              </p>
            </section>
            <div className="wallet-stack patrimony-stack">
              <a className="card account-card card-inverse" href="#/cuentas" style={{ textDecoration: 'none' }}>
                <div className="hero-heading">
                  <span className="eyebrow">Tu patrimonio en cuentas</span>
                  <span className="glass-icon">
                    <Icon name="cuentas" size={21} />
                  </span>
                </div>
                <div className="mid-number">{formatMoney(total)}</div>
                <div className="muted card-link">
                  <span>
                    {cuentasPersonales.length} cuenta{cuentasPersonales.length === 1 ? '' : 's'} · Ver cuentas
                  </span>
                  <span className="glass-icon">
                    <Icon name="flecha" size={18} />
                  </span>
                </div>
              </a>
            </div>
          </div>
          <HomeRecurring />
          <BudgetReview mes={mes} />
          <section className="month-summary" aria-label="Resumen del mes">
            <div>
              <span className="eyebrow">Balance de {monthLabel(mes, false)}</span>
              <strong>{formatMoney(resumen.neto)}</strong>
              <small>Ingresos menos gastos</small>
            </div>
            <div>
              <span className="summary-icon income-text">
                <Icon name="ingreso" size={20} />
              </span>
              <span className="kpi-label">Ingresos del mes</span>
              <strong className="income-text">{formatMoney(resumen.ingresos)}</strong>
            </div>
            <div>
              <span className="summary-icon expense-text">
                <Icon name="gasto" size={20} />
              </span>
              <span className="kpi-label">Gastos del mes</span>
              <strong className="expense-text">{formatMoney(resumen.gastos)}</strong>
            </div>
          </section>

          <div className="grid grid-insights">
            <section className="card evolution-card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Tu evolución</h2>
                  <div className="card-sub">Ingresos y gastos, mes a mes</div>
                </div>
                <Segmented
                  opciones={config.inicio.periodosGrafico}
                  valor={periodo}
                  onChange={setPeriodo}
                  etiqueta="Periodo del gráfico"
                />
              </div>
              <LineChart
                key={periodo}
                titulo={`Ingresos y gastos de los últimos ${meses} meses`}
                datos={serie.map((s) => ({
                  clave: s.mes,
                  etiqueta: monthShortLabel(s.mes),
                  nombre: monthLabel(s.mes),
                  enCurso: s.mes === mes,
                  ingresos: s.ingresos,
                  gastos: s.gastos,
                }))}
              />
            </section>
            <section className="card category-card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Dónde va tu dinero</h2>
                  <div className="card-sub">Gastos de {monthLabel(mes, false)}</div>
                </div>
              </div>
              {porciones.length === 0 ? (
                <div className="empty">
                  <div>Todavía no hay gastos este mes.</div>
                </div>
              ) : (
                <Donut porciones={porciones} titulo={`Gasto por categoría en ${monthLabel(mes)}`} />
              )}
              {creditos.length > 0 && (
                <div className="category-refunds">
                  <p>Devoluciones que superan los gastos de su categoría este mes:</p>
                  <dl className="finance-breakdown">
                    {creditos.map((p) => (
                      <div key={p.categoriaId}>
                        <dt>{categorias.get(p.categoriaId ?? '')?.nombre ?? 'Sin categoría'}</dt>
                        <dd>{formatMoney(-p.importe)}</dd>
                      </div>
                    ))}
                  </dl>
                  <small>
                    El anillo muestra las categorías con gasto neto positivo. Estas devoluciones se restan del gasto
                    total del mes.
                  </small>
                </div>
              )}
            </section>
          </div>

          <BackupReminder />
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Últimos movimientos</h2>
              <a className="btn btn-ghost btn-sm" href="#/movimientos">
                Ver todos
              </a>
            </div>
            {recientes.length === 0 ? (
              <div className="empty">
                <div>Aún no has apuntado ningún movimiento.</div>
              </div>
            ) : (
              <div className="list">
                {recientes.map((m) => (
                  <MovimientoRow
                    key={m.id}
                    m={m}
                    categorias={categorias}
                    cuentas={mapaCuentas}
                    onClick={() => setForm({ movimiento: m })}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {verDisponible && <AvailableDetails cerrar={() => setVerDisponible(false)} />}
      {form && <MovimientoForm tipoInicial={form.tipo} movimiento={form.movimiento} onClose={() => setForm(null)} />}
    </>
  );
}
