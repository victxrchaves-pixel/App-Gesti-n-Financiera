import { useState } from 'react';
import { formatMoney, porcentaje } from '../lib/money';

export interface Porcion {
  id: string;
  nombre: string;
  color: string;
  importe: number;
}

const TAU = Math.PI * 2;

function arco(cx: number, cy: number, r: number, grosor: number, a0: number, a1: number): string {
  const ri = r - grosor;
  const p = (rad: number, ang: number) => [cx + rad * Math.sin(ang), cy - rad * Math.cos(ang)];
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r, a0);
  const [x1, y1] = p(r, a1);
  const [x2, y2] = p(ri, a1);
  const [x3, y3] = p(ri, a0);
  return `M${x0} ${y0}A${r} ${r} 0 ${grande} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${grande} 0 ${x3} ${y3}Z`;
}

/** Gráfico de dona con leyenda; la leyenda lleva siempre nombre, % e importe. */
export function Donut({ porciones, titulo }: { porciones: Porcion[]; titulo: string }) {
  const [activa, setActiva] = useState<string | null>(null);
  const total = porciones.reduce((s, p) => s + p.importe, 0);
  const size = 180;
  const r = size / 2;
  const grosor = 22;
  const hueco = porciones.length > 1 ? 0.012 * TAU : 0; // separación de 2px aprox. entre porciones

  let ang = 0;
  const segmentos = porciones.map((p) => {
    const a = (p.importe / total) * TAU;
    const seg = { ...p, a0: ang + hueco / 2, a1: ang + a - hueco / 2 };
    ang += a;
    return seg;
  });
  const sel = porciones.find((p) => p.id === activa);

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={titulo}>
        {porciones.length === 1 ? (
          <circle cx={r} cy={r} r={r - grosor / 2} fill="none" stroke={porciones[0].color} strokeWidth={grosor} />
        ) : (
          segmentos.map((s) => (
            <path
              key={s.id}
              d={arco(r, r, r, grosor, s.a0, Math.max(s.a0 + 0.001, s.a1))}
              fill={s.color}
              className={`donut-seg${activa && activa !== s.id ? ' dim' : ''}`}
              onPointerEnter={() => setActiva(s.id)}
              onPointerLeave={() => setActiva(null)}
            />
          ))
        )}
        <text x={r} y={r - 4} textAnchor="middle" className="donut-center" fontSize={sel ? 17 : 19} fill="var(--text)">
          {formatMoney(sel ? sel.importe : total, { sinCentimosSiCero: true })}
        </text>
        <text x={r} y={r + 16} textAnchor="middle" fontSize={12} fill="var(--text-3)">
          {sel ? sel.nombre : 'en total'}
        </text>
      </svg>
      <div className="legend">
        {porciones.map((p) => (
          <div
            key={p.id}
            className="legend-row"
            onPointerEnter={() => setActiva(p.id)}
            onPointerLeave={() => setActiva(null)}
            style={{ opacity: activa && activa !== p.id ? 0.45 : 1 }}
          >
            <span className="dot" style={{ background: p.color }} />
            <span className="name">{p.nombre}</span>
            <span className="pct">{porcentaje(p.importe, total)} %</span>
            <span className="amt">{formatMoney(p.importe)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
