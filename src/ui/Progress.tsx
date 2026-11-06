import type { CSSProperties } from 'react';
export function Progress({
  valor,
  total,
  etiqueta,
  color,
}: {
  valor: number;
  total: number;
  etiqueta: string;
  color?: string | null;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (valor / total) * 100)) : 0;
  return (
    <div
      className={`fill-track${valor > total ? ' over-limit' : ''}`}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${Math.round(total ? (valor / total) * 100 : 0)} %${valor > total ? ' · límite superado' : ''}`}
      style={{ '--fill-color': color ?? 'var(--primary-ink)' } as CSSProperties}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
