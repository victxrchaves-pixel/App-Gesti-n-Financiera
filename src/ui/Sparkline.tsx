import type { PuntoMercado } from '../lib/mercado';
import { formatPct, variacion } from '../lib/mercado';

/** Mini gráfica de la evolución reciente del precio: verde si sube, roja si baja. */
export function Sparkline({
  puntos,
  dias,
  width = 96,
  height = 34,
}: {
  puntos: PuntoMercado[];
  dias: number;
  width?: number;
  height?: number;
}) {
  const v = variacion(puntos);
  if (!v) return <span className="sparkline sparkline-empty" aria-hidden="true" />;
  const min = Math.min(...puntos.map((p) => p.precioEUR));
  const max = Math.max(...puntos.map((p) => p.precioEUR));
  const rango = max - min || 1;
  const pts = puntos.map((p, i) => [
    (i / (puntos.length - 1)) * (width - 4) + 2,
    height - 3 - ((p.precioEUR - min) / rango) * (height - 6),
  ]);
  const linea = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const sube = v.cambio >= 0;
  return (
    <svg
      className={`sparkline ${sube ? 'is-up' : 'is-down'}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${sube ? 'Sube' : 'Baja'} ${formatPct(v.pct)} en ${dias} días`}
    >
      <path d={`${linea}L${width - 2},${height}L2,${height}Z`} className="sparkline-area" />
      <path d={linea} className="sparkline-line" />
    </svg>
  );
}
