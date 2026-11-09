import { useMemo, useState } from 'react';
import { colorCategoria, config } from '../config/neto.config';
import { useCuentas, useMapaCategorias, useMovimientos, usePresupuestos } from '../db/hooks';
import { estadoPresupuesto, gastosPresupuesto, resumenPresupuestos } from '../lib/budgets';
import { monthLabel, todayISO } from '../lib/dates';
import { iconoCategoria } from '../lib/iconos';
import { formatMoney } from '../lib/money';
import { CategoryIcon } from './CategoryIcon';
import { Icon } from './Icon';
import { PlanPorcentajes } from './PlanPorcentajes';
import { Progress } from './Progress';

const MAX_SOBRES_INICIO = 4;

/** Presupuestos del mes en Inicio: lo que queda, los sobres más gastados y los avisos. */
export function HomeBudgets({ mes }: { mes: string }) {
  const presupuestos = usePresupuestos(mes);
  const movimientos = useMovimientos();
  const cuentas = useCuentas();
  const categorias = useMapaCategorias();
  const [crear, setCrear] = useState(false);
  const hoy = todayISO();

  const resumen = useMemo(
    () => resumenPresupuestos(presupuestos, gastosPresupuesto(movimientos, cuentas, mes, hoy)),
    [presupuestos, movimientos, cuentas, mes, hoy],
  );
  const filas = [...resumen.filas].sort((a, b) => b.gastado / b.limite - a.gastado / a.limite);
  const superados = filas.filter((f) => f.gastado > f.limite).length;
  const cerca = filas.filter(
    (f) => f.gastado <= f.limite && (f.gastado / f.limite) * 100 >= config.presupuestos.avisoPorcentaje,
  ).length;

  if (!presupuestos.length)
    return (
      <section className="card home-budgets home-budgets-empty">
        <span className="plan-auto-icon">
          <Icon name="presupuestos" size={22} />
        </span>
        <div>
          <h2 className="card-title">Aún no tienes presupuesto para {monthLabel(mes, false)}</h2>
          <p className="field-hint">
            Dinos cuánto ingresas al mes y Neto reparte un límite para cada categoría. Tardas un minuto.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setCrear(true)}>
          Crear según mis ingresos
        </button>
        {crear && <PlanPorcentajes mes={mes} onClose={() => setCrear(false)} />}
      </section>
    );

  return (
    <section className="card home-budgets">
      <div className="card-header">
        <div>
          <h2 className="card-title">Tus presupuestos de {monthLabel(mes, false)}</h2>
          <div className="card-sub">
            {resumen.restante >= 0
              ? `Te quedan ${formatMoney(resumen.restante)} de ${formatMoney(resumen.limite)}`
              : `Te has pasado ${formatMoney(-resumen.restante)} de ${formatMoney(resumen.limite)}`}
          </div>
        </div>
        <a className="btn btn-ghost btn-sm" href="#/presupuestos">
          Ver todos
        </a>
      </div>
      {(superados > 0 || cerca > 0) && (
        <div className={`home-budgets-alert${superados ? ' is-over' : ''}`} role="status">
          <Icon name={superados ? 'alerta' : 'aviso'} size={16} />
          {[
            superados ? `${superados} superado${superados === 1 ? '' : 's'}` : null,
            cerca ? `${cerca} cerca del límite (${config.presupuestos.avisoPorcentaje} %)` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
      <div className="home-budgets-list">
        {filas.slice(0, MAX_SOBRES_INICIO).map((f) => {
          const cat = categorias.get(f.categoriaId);
          const color = f.color ?? colorCategoria(cat?.color);
          const estado = estadoPresupuesto(f.gastado, f.limite);
          const pct = Math.round((Math.max(0, f.gastado) / f.limite) * 100);
          return (
            <a className="home-budget" href="#/presupuestos" key={f.id}>
              <CategoryIcon icono={cat ? iconoCategoria(cat) : 'otros'} color={colorCategoria(color)} size={38} />
              <span className="home-budget-main">
                <span className="home-budget-top">
                  <b>{cat?.nombre ?? 'Categoría eliminada'}</b>
                  <span className={estado === 'Superado' ? 'expense-text' : 'muted'}>
                    {formatMoney(Math.max(0, f.gastado))} de {formatMoney(f.limite)}
                  </span>
                </span>
                <Progress valor={f.gastado} total={f.limite} etiqueta={`Presupuesto de ${cat?.nombre}`} color={color} />
                <span className="home-budget-state">
                  {pct} % · {estado}
                </span>
              </span>
            </a>
          );
        })}
      </div>
      {filas.length > MAX_SOBRES_INICIO && (
        <a className="home-budgets-more" href="#/presupuestos">
          Y {filas.length - MAX_SOBRES_INICIO} sobres más
        </a>
      )}
    </section>
  );
}
