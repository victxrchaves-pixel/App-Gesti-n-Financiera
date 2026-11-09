import { AvailableDetails, HomeRecurring, BackupReminder } from '../ui/HomeFinance';
import { BudgetReview } from '../ui/BudgetReview';
import { HomeBudgets } from '../ui/HomeBudgets';
import { useMemo, useState } from 'react';
import { colorCategoria, config } from '../config/neto.config';
import { useAjustes, useCuentas, useMapaCategorias, useMovimientos, useHoy } from '../db/hooks';
import { patrimonio, dineroDisponible, esRepartoInterno, saldosPorCuenta } from '../lib/balances';
import { greeting, longDate, monthKey, monthLabel, monthShortLabel } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { gastoPorCategoria, ordenarMovimientos, resumenMes, ultimosMeses } from '../lib/stats';
import { PageHeader } from '../layout/Shell';
import { LineChart } from '../ui/LineChart';
import { Segmented } from '../ui/Segmented';
import { Donut, type Porcion } from '../ui/Donut';
import { Icon } from '../ui/Icon';
import { AccionesRedondas, ImporteGrande, TarjetaLista } from '../ui/Panel';
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
        movimientos.filter(
          (m) =>
            m.fecha <= hoy && mapaCuentas.get(m.cuentaId)?.ambito === 'personal' && !esRepartoInterno(m, mapaCuentas),
        ),
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
  // Las cuentas que forman el patrimonio, de más a menos saldo, para la tarjeta de Inicio.
  const saldos = saldosPorCuenta(cuentas, movimientos);
  const cuentasOrdenadas = [...cuentasPersonales].sort((a, b) => (saldos.get(b.id) ?? 0) - (saldos.get(a.id) ?? 0));
  const positivo = cuentasOrdenadas.reduce((t, c) => t + Math.max(0, saldos.get(c.id) ?? 0), 0);
  const nombre = ajustes?.nombre ? `, ${ajustes.nombre}` : '';
  const fechaTexto = longDate(hoy);

  const nombreCuenta = (t: string) => config.tiposCuenta.find((x) => x.id === t)?.nombre ?? t;

  if (cuentasPersonales.length === 0)
    return (
      <>
        <PageHeader
          titulo={`${greeting(ahora.getHours())}${nombre}`}
          subtitulo={fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}
        />
        <div className="card">
          <div className="empty">
            <div className="empty-title">Empieza creando tu primera cuenta</div>
            <div>Añade tu cuenta del banco, tu efectivo o tus ahorros con el saldo que tienen hoy.</div>
            <a className="btn btn-primary" href="#/cuentas">
              Ir a Cuentas
            </a>
          </div>
        </div>
      </>
    );

  return (
    <>
      <h1 className="sr-only">Inicio</h1>
      <section className="home-hero" aria-label="Tu patrimonio">
        <span className="home-hero-label">
          {greeting(ahora.getHours())}
          {nombre} · Patrimonio
        </span>
        <ImporteGrande cents={total} />
        <a className="pill-link" href="#/cuentas">
          {cuentasPersonales.length === 1 ? '1 cuenta' : `${cuentasPersonales.length} cuentas`}
          <Icon name="derecha" size={16} />
        </a>
        <AccionesRedondas
          acciones={[
            { icono: 'gasto', texto: 'Gasto', onClick: () => setForm({ tipo: 'gasto' }) },
            { icono: 'ingreso', texto: 'Ingreso', onClick: () => setForm({ tipo: 'ingreso' }) },
            { icono: 'transferencia', texto: 'Mover', onClick: () => setForm({ tipo: 'transferencia' }) },
            { icono: 'presupuestos', texto: 'Presupuesto', href: '#/presupuestos' },
          ]}
        />
      </section>

      <div className="home-columns">
        <div className="home-main">
          <HomeRecurring />
          <BudgetReview mes={mes} />

          <TarjetaLista
            className="home-movements"
            titulo="Movimientos"
            enlace={{ texto: 'Ver todos', href: '#/movimientos' }}
          >
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
          </TarjetaLista>

          <TarjetaLista className="home-accounts" titulo="Cuentas" enlace={{ texto: 'Ver todas', href: '#/cuentas' }}>
            <ul className="account-rows">
              {cuentasOrdenadas.map((c) => (
                <li key={c.id}>
                  <a href="#/cuentas">
                    <span className="account-row-icon" aria-hidden="true">
                      <Icon name={c.ahorroGeneral ? 'ahorro' : c.tipo} size={20} />
                    </span>
                    <span className="account-row-text">
                      <strong>{c.nombre}</strong>
                      <small>
                        {c.ahorroGeneral ? 'Ahorro y metas' : nombreCuenta(c.tipo)}
                        {positivo > 0 && (saldos.get(c.id) ?? 0) > 0
                          ? ` · ${Math.round(((saldos.get(c.id) ?? 0) / positivo) * 100)} %`
                          : ''}
                      </small>
                    </span>
                    <span className={`account-row-amount${(saldos.get(c.id) ?? 0) < 0 ? ' expense-text' : ''}`}>
                      {formatMoney(saldos.get(c.id) ?? 0)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </TarjetaLista>

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
        </div>

        <aside className="home-side" aria-label="Resumen">
          <div className="widget-grid">
            <button type="button" className="widget" onClick={() => setVerDisponible(true)}>
              <span className="widget-label">Disponible</span>
              <strong>{formatMoney(disponible.disponible)}</strong>
              <small>Para gastar · Ver cómo</small>
            </button>
            <a className="widget" href="#/movimientos">
              <span className="widget-label">Gastado en {monthLabel(mes, false)}</span>
              <strong>{formatMoney(resumen.gastos)}</strong>
              <small className="income-text">+{formatMoney(resumen.ingresos)} ingresos</small>
            </a>
            <a className="widget" href="#/metas">
              <span className="widget-label">Ahorro</span>
              <strong>{formatMoney(disponible.ahorro)}</strong>
              <small>Repartido en tus metas</small>
            </a>
            <div className="widget">
              <span className="widget-label">Balance del mes</span>
              <strong className={resumen.neto < 0 ? 'expense-text' : undefined}>{formatMoney(resumen.neto)}</strong>
              <small>Ingresos menos gastos</small>
            </div>
          </div>

          <HomeBudgets mes={mes} />

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
                  El anillo muestra las categorías con gasto neto positivo. Estas devoluciones se restan del gasto total
                  del mes.
                </small>
              </div>
            )}
          </section>

          <BackupReminder />
        </aside>
      </div>

      {verDisponible && <AvailableDetails cerrar={() => setVerDisponible(false)} />}
      {form && <MovimientoForm tipoInicial={form.tipo} movimiento={form.movimiento} onClose={() => setForm(null)} />}
    </>
  );
}
