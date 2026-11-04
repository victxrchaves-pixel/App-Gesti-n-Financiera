import { useId, useState } from 'react';
import { useWidth } from './useWidth';
export interface ValorGrafico { fecha: string; valor: number }
export function ValueChart({ datos, etiqueta, precio = false }: { datos: ValorGrafico[]; etiqueta: string; precio?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>(); const id = useId(); const [seleccion, setSeleccion] = useState<number | null>(null);
  const puntos = datos.filter(d => Number.isFinite(d.valor) && Number.isFinite(Date.parse(d.fecha)));
  if (!puntos.length) return <div className="value-chart" ref={ref}><div className="empty"><div>Aún no hay valoraciones registradas.</div><div>El histórico empezará con tu primera inversión.</div></div></div>;
  const active = Math.min(seleccion ?? puntos.length - 1, puntos.length - 1);
  const selected = puntos[active]; const h = 180; const left = 14; const right = Math.max(left + 1, width - 14);
  const max = Math.max(...puntos.map(p => p.valor)); const min = Math.min(...puntos.map(p => p.valor));
  const pad = Math.max((max - min) * .15, max * .005, .000001); const low = Math.max(0, min - pad); const high = max + pad;
  const first = Date.parse(puntos[0].fecha); const last = Date.parse(puntos[puntos.length - 1].fecha);
  const x = (p: ValorGrafico) => last === first ? width / 2 : left + (Date.parse(p.fecha) - first) / (last - first) * (right - left);
  const y = (value: number) => 16 + (high - value) / (high - low) * (h - 32);
  const path = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(p)},${y(p.valor)}`).join(' ');
  const money = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: precio ? 6 : 2 }).format(value);
  return <div className="value-chart" ref={ref}>
    <div className="chart-period">{selected.fecha.slice(0, 10).split('-').reverse().join('/')}</div><div className="mid-number">{money(selected.valor)}</div>
    <svg role="img" aria-label={etiqueta} viewBox={`0 0 ${width} ${h}`} width="100%" height={h}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8860b0" stopOpacity=".16" /><stop offset="100%" stopColor="#8860b0" stopOpacity="0" /></linearGradient></defs>
      {[16, h / 2, h - 16].map(v => <line key={v} x1={left} x2={right} y1={v} y2={v} stroke="var(--line)" strokeDasharray="3 6" />)}
      {puntos.length > 1 && <path d={`${path} L${x(puntos[puntos.length - 1])},${h - 16} L${x(puntos[0])},${h - 16} Z`} fill={`url(#${id})`} />}
      <path d={path} stroke="#8860b0" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={x(selected)} x2={x(selected)} y1="16" y2={h - 16} stroke="var(--line-strong)" strokeDasharray="3 4" />
      <circle cx={x(selected)} cy={y(selected.valor)} r="5" fill="white" stroke="#8860b0" strokeWidth="2" />
    </svg>
    {puntos.length > 1 ? <><label className="sr-only" htmlFor={`range-${id}`}>Seleccionar fecha de {etiqueta}</label><input id={`range-${id}`} type="range" className="chart-slider" min="0" max={puntos.length - 1} value={active} aria-valuetext={`${selected.fecha.slice(0,10)}: ${money(selected.valor)}`} onChange={e => setSeleccion(Number(e.target.value))} /><div className="chart-endpoints"><span>{puntos[0].fecha.slice(0,10)}</span><span>{puntos[puntos.length - 1].fecha.slice(0,10)}</span></div></> : <p className="field-hint">Primera valoración guardada. La línea aparecerá al registrar valoraciones en otros días.</p>}
    <p className="field-hint">Escala ajustada al rango de valores mostrado.</p>
  </div>;
}
