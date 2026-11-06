import { useState } from 'react';
import { formatMoney } from '../lib/money';
import { useWidth } from './useWidth';

/**
 * Evolución compacta (por meses) para tarjetas: línea suave, área tenue y un punto por mes.
 * Hereda el color del texto (`currentColor`), así sirve en tarjetas claras y oscuras.
 */
export function TrendChart({
  puntos,
  titulo,
  alto = 120,
}: {
  puntos: { etiqueta: string; valor: number }[];
  titulo: string;
  alto?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(420);
  const [activo, setActivo] = useState<number | null>(null);
  if (puntos.length < 2) return null;
  const pie = 22;
  const h = alto - pie;
  const min = Math.min(...puntos.map((p) => p.valor));
  const max = Math.max(...puntos.map((p) => p.valor));
  const margen = Math.max((max - min) * 0.15, 1);
  const y = (v: number) => 8 + ((max + margen - v) / (max - min + 2 * margen)) * (h - 16);
  const x = (i: number) => 8 + (i / (puntos.length - 1)) * (width - 16);
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join('');
  const sel = activo ?? puntos.length - 1;
  return (
    <div className="trend-chart" ref={ref}>
      <svg width={width} height={alto} role="img" aria-label={titulo} onPointerLeave={() => setActivo(null)}>
        <path d={`${linea}L${x(puntos.length - 1)},${h}L${x(0)},${h}Z`} className="trend-area" />
        <path d={linea} className="trend-line" />
        {puntos.map((p, i) => (
          <g key={p.etiqueta + i} onPointerEnter={() => setActivo(i)}>
            <rect
              x={x(i) - width / puntos.length / 2}
              y={0}
              width={width / puntos.length}
              height={alto}
              fill="transparent"
            />
            <circle
              cx={x(i)}
              cy={y(p.valor)}
              r={i === sel ? 4.5 : 2.5}
              className={i === sel ? 'trend-dot is-active' : 'trend-dot'}
            />
            <text
              x={x(i)}
              y={alto - 6}
              textAnchor="middle"
              className={i === sel ? 'trend-label is-active' : 'trend-label'}
            >
              {p.etiqueta}
            </text>
          </g>
        ))}
      </svg>
      <div className="trend-tooltip" style={{ left: Math.max(50, Math.min(width - 50, x(sel))) }}>
        {formatMoney(puntos[sel].valor)}
      </div>
    </div>
  );
}
