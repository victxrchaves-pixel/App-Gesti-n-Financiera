import { useMemo, useState } from 'react';
import { config } from '../config/neto.config';
import { useAjustes, useCuentas, useMapaCategorias, useMovimientos } from '../db/hooks';
import { patrimonio } from '../lib/balances';
import { greeting, longDate, monthKey, monthLabel, monthShortLabel, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { gastoPorCategoria, ordenarMovimientos, resumenMes, ultimosMeses } from '../lib/stats';
import { PageHeader } from '../layout/Shell';
import { Bars } from '../ui/Bars';
import { Donut, type Porcion } from '../ui/Donut';
import { Icon } from '../ui/Icon';
import { MovimientoForm } from '../ui/MovimientoForm';
import { MovimientoRow } from '../ui/MovimientoRow';
import type { Movimiento } from '../db/types';

export function Inicio() {
  const ajustes = useAjustes();
  const cuentas = useCuentas();
  const movimientos = useMovimientos();
  const categorias = useMapaCategorias();
  const [form, setForm] = useState<{ movimiento?: Movimiento } | null>(null);

  const hoy = todayISO();
  const mes = monthKey(hoy);
  const ahora = new Date();

  const resumen = useMemo(() => resumenMes(movimientos, cuentas, mes), [movimientos, cuentas, mes]);
  const total = useMemo(() => patrimonio(cuentas, movimientos, 'personal'), [cuentas, movimientos]);
  const serie = useMemo(() => ultimosMeses(movimientos, cuentas, mes, config.inicio.mesesHistorico), [movimientos, cuentas, mes]);
  const mapaCuentas = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas]);
  const recientes = useMemo(
    () => ordenarMovimientos(movimientos.filter((m) => mapaCuentas.get(m.cuentaId)?.ambito === 'personal')).slice(0, config.inicio.ultimosMovimientos),
    [movimientos, mapaCuentas],
  );

  const porciones = useMemo<Porcion[]>(() => {
    const lista = gastoPorCategoria(movimientos, cuentas, mes);
    const max = config.inicio.maxCategoriasDona;
    const visibles = lista.length > max ? lista.slice(0, max - 1) : lista;
    const resto = lista.slice(visibles.length).reduce((s, x) => s + x.importe, 0);
    const out: Porcion[] = visibles.map((x) => {
      const c = x.categoriaId ? categorias.get(x.categoriaId) : undefined;
      return { id: x.categoriaId ?? 'sin', nombre: c?.nombre ?? 'Sin categoría', color: c?.color ?? config.colorOtros, importe: x.importe };
    });
    if (resto > 0) out.push({ id: 'resto', nombre: 'Resto', color: '#C9C8C1', importe: resto });
    return out;
  }, [movimientos, cuentas, mes, categorias]);

  const cuentasPersonales = cuentas.filter((c) => c.ambito === 'personal' && !c.archivada);
  const nombre = ajustes?.nombre ? `, ${ajustes.nombre}` : '';
  const fechaTexto = longDate(hoy);

  return (
    <>
      <PageHeader
        titulo={`${greeting(ahora.getHours())}${nombre}`}
        subtitulo={fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)}
        acciones={<button className="btn btn-primary" onClick={() => setForm({})}><Icon name="mas" size={16} stroke={2.2} />Nuevo movimiento</button>}
      />

      {cuentasPersonales.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-title">Empieza creando tu primera cuenta</div>
            <div>Añade tu cuenta del banco, tu efectivo o tus ahorros con el saldo que tienen hoy.</div>
            <a className="btn btn-primary" href="#/cuentas">Ir a Cuentas</a>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="grid grid-hero">
            <section className="card">
              <div className="eyebrow">Te queda este mes</div>
              <div className={`big-number${resumen.neto < 0 ? ' danger-text' : ''}`}>{formatMoney(resumen.neto)}</div>
              <div className="kpis">
                <div><div className="kpi-label">Ingresos de {monthLabel(mes, false)}</div><div className="kpi-value">{formatMoney(resumen.ingresos)}</div></div>
                <div><div className="kpi-label">Gastos de {monthLabel(mes, false)}</div><div className="kpi-value">{formatMoney(resumen.gastos)}</div></div>
              </div>
            </section>
            <a className="card account-card" href="#/cuentas" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="eyebrow">Patrimonio</div>
              <div className="mid-number">{formatMoney(total)}</div>
              <div className="muted" style={{ marginTop: 'auto', fontSize: 14 }}>
                {cuentasPersonales.length} cuenta{cuentasPersonales.length === 1 ? '' : 's'} · Ver cuentas
              </div>
            </a>
          </div>

          <div className="grid grid-2">
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Gasto por categoría</h2>
                <span className="card-sub">{monthLabel(mes)}</span>
              </div>
              {porciones.length === 0 ? (
                <div className="empty"><div>Todavía no hay gastos este mes.</div></div>
              ) : (
                <Donut porciones={porciones} titulo={`Gasto por categoría en ${monthLabel(mes)}`} />
              )}
            </section>
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Últimos {config.inicio.mesesHistorico} meses</h2>
              </div>
              <Bars
                titulo={`Ingresos y gastos de los últimos ${config.inicio.mesesHistorico} meses`}
                datos={serie.map((s) => ({ clave: s.mes, etiqueta: monthShortLabel(s.mes), ingresos: s.ingresos, gastos: s.gastos, destacada: s.mes === mes }))}
              />
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Últimos movimientos</h2>
              <a className="btn btn-ghost btn-sm" href="#/movimientos">Ver todos</a>
            </div>
            {recientes.length === 0 ? (
              <div className="empty"><div>Aún no has apuntado ningún movimiento.</div></div>
            ) : (
              <div className="list">
                {recientes.map((m) => (
                  <MovimientoRow key={m.id} m={m} categorias={categorias} cuentas={mapaCuentas} onClick={() => setForm({ movimiento: m })} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {form && <MovimientoForm movimiento={form.movimiento} onClose={() => setForm(null)} />}
    </>
  );
}
