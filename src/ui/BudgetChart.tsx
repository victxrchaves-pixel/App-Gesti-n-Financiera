import { useId, useState } from 'react';
import { formatMoney } from '../lib/money';
import { shortDate } from '../lib/dates';
import { useWidth } from './useWidth';

export function BudgetChart({ puntos, dias, limite }: { puntos: { fecha: string; gastado: number }[]; dias: number; limite: number }) {
  const [ref, ancho] = useWidth<HTMLDivElement>();
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const id = useId();
  const indice = Math.min(seleccion ?? puntos.length - 1, puntos.length - 1);
  const actual = puntos[indice];
  const left = 48, right = Math.max(left + 1, ancho - 12), alto = 200;
  const max = Math.max(limite, ...puntos.map(p => p.gastado), 100) * 1.12;
  const x = (dia: number) => left + (dia - 1) / Math.max(1, puntos.length - 1) * (right - left);
  const y = (valor: number) => 16 + (1 - valor / max) * (alto - 32);
  const path = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i + 1)},${y(p.gastado)}`).join(' ');
  const compacto = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
  return <div ref={ref} className="budget-chart">
    {actual ? <>
      <div className="chart-readout"><div className="chart-period">Hasta el {shortDate(actual.fecha, actual.fecha)}</div><div className="chart-values"><div><span className="chart-key"><i style={{ background: 'var(--budget-ink, var(--primary-ink))' }} />Gasto acumulado</span><strong>{formatMoney(actual.gastado)}</strong></div><div><span className="chart-key"><i className="key-expense" />Límite mensual</span><strong>{formatMoney(limite)}</strong></div></div></div>
      <svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label="Gasto acumulado por día frente al límite mensual">
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--budget-ink, var(--primary-ink))" stopOpacity=".18" /><stop offset="100%" stopColor="var(--budget-ink, var(--primary-ink))" stopOpacity="0" /></linearGradient></defs>
        {[0, .5, 1].map(v => <g key={v}><line x1={left} x2={right} y1={y(max * v)} y2={y(max * v)} stroke="var(--line)" strokeDasharray="3 6" /><text x={left - 8} y={y(max * v)} dy=".3em" textAnchor="end" fill="var(--text-3)" fontSize="10">{compacto.format(max * v / 100)}</text></g>)}
        <text x={left - 8} y="7" textAnchor="end" fill="var(--text-3)" fontSize="9">EUR</text>
        <line x1={left} x2={right} y1={y(limite)} y2={y(limite)} stroke="var(--text-2)" strokeWidth="1.5" strokeDasharray="5 5" />
        <path d={`${path} L${x(puntos.length)},${y(0)} L${left},${y(0)} Z`} fill={`url(#${id})`} />
        <path d={path} stroke="var(--budget-ink, var(--primary-ink))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <line x1={x(indice + 1)} x2={x(indice + 1)} y1="16" y2={y(0)} stroke="var(--line-strong)" strokeDasharray="3 5" />
        {puntos.map((p, i) => <circle key={p.fecha} cx={x(i + 1)} cy={y(p.gastado)} r={i === indice ? 5 : 2} fill="var(--card)" stroke="var(--budget-ink, var(--primary-ink))" strokeWidth="1.5" />)}
      </svg>
      <div className="chart-endpoints"><span>Día 1</span><span>Día {puntos.length} de {dias}</span></div>
      {puntos.length > 1 && <><label className="sr-only" htmlFor={id + '-day'}>Consultar día del presupuesto</label><input id={id + '-day'} className="chart-slider" type="range" min="0" max={puntos.length - 1} value={indice} onChange={e => setSeleccion(Number(e.target.value))} aria-valuetext={`${shortDate(actual.fecha, actual.fecha)}: ${formatMoney(actual.gastado)}`} /></>}
      <p className="field-hint">Línea continua: gastos registrados. Línea discontinua: límite del mes. Los días futuros quedan sin trazar.</p>
    </> : <div className="empty"><div className="empty-title">Tu plan está preparado</div><div>La evolución se mostrará cuando empiece este mes.</div></div>}
  </div>;
}
