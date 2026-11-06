import { useState } from 'react';
import { formatMoney, porcentaje } from '../lib/money';

export interface Porcion {
  id: string;
  nombre: string;
  color: string;
  importe: number;
}
const TAU = Math.PI * 2;

/** Los anillos segmentados respetan cada proporción; los segmentos pequeños tienen extremos planos para no exagerarlos. */
export function Donut({ porciones, titulo }: { porciones: Porcion[]; titulo: string }) {
  const [activa, setActiva] = useState<string | null>(null);
  const valores = porciones.filter((p) => Number.isFinite(p.importe) && p.importe > 0);
  const total = valores.reduce((s, p) => s + p.importe, 0);
  const size = 208,
    r = 87,
    grosor = 20,
    circunferencia = TAU * r;
  let recorrido = 0;
  const segmentos = valores.map((p) => {
    const longitud = (p.importe / total) * circunferencia;
    const separacion = valores.length > 1 ? Math.min(9, longitud * 0.2) : 0;
    const redondo = longitud - separacion > grosor + 1;
    const inicio = recorrido + (separacion + (redondo ? grosor : 0)) / 2;
    recorrido += longitud;
    return { ...p, inicio, longitud: Math.max(0.01, longitud - separacion - (redondo ? grosor : 0)), redondo };
  });
  const sel = valores.find((p) => p.id === activa);
  return (
    <div className="donut-wrap">
      <div className="ring-visual">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={titulo}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-sunken)" strokeWidth={grosor} />
          {segmentos.map((p) => (
            <circle
              key={p.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              fill="none"
              stroke={p.color}
              strokeWidth={grosor}
              strokeLinecap={p.redondo ? 'round' : 'butt'}
              strokeDasharray={`${p.longitud} ${circunferencia - p.longitud}`}
              strokeDashoffset={-p.inicio}
              className={`donut-seg${activa && activa !== p.id ? ' dim' : ''}`}
              onPointerEnter={() => setActiva(p.id)}
              onPointerLeave={() => setActiva(null)}
            />
          ))}
        </svg>
        <div className="ring-center" aria-live="polite">
          <span>{sel ? `${porcentaje(sel.importe, total)} % del total` : 'Total'}</span>
          <strong>{formatMoney(sel?.importe ?? total, { sinCentimosSiCero: true })}</strong>
          <small>{sel?.nombre ?? 'Todos los conceptos'}</small>
        </div>
      </div>
      <div className="legend">
        {valores.map((p) => (
          <button
            type="button"
            key={p.id}
            className="legend-row"
            aria-pressed={activa === p.id}
            onPointerEnter={(e) => {
              if (e.pointerType !== 'touch') setActiva(p.id);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'touch') setActiva(null);
            }}
            onFocus={() => setActiva(p.id)}
            onBlur={() => setActiva(null)}
            onClick={() => setActiva(p.id)}
            style={{ opacity: activa && activa !== p.id ? 0.45 : 1 }}
          >
            <span className="dot" style={{ background: p.color }} />
            <span className="name">{p.nombre}</span>
            <span className="pct">{porcentaje(p.importe, total)} %</span>
            <span className="amt">{formatMoney(p.importe)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
