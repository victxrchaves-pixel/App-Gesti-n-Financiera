import { useState } from 'react';
import { config } from '../config/neto.config';
import { formatMoney } from '../lib/money';
import { useWidth } from './useWidth';

export interface Barra {
  clave: string;
  etiqueta: string;
  ingresos: number;
  gastos: number;
  destacada?: boolean;
}

/** Marca "redonda" para el eje: 0, 500, 1.000, 2.000, 5.000, 10.000... (en euros). */
function pasoBonito(maxEuros: number, divisiones = 4): number {
  const bruto = maxEuros / divisiones;
  const mag = 10 ** Math.floor(Math.log10(Math.max(bruto, 1)));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * mag >= bruto) return f * mag;
  return 10 * mag;
}

function etiquetaEje(euros: number): string {
  if (euros >= 10000) return `${formatMoney(Math.round(euros / 1000) * 100, { simbolo: false, sinCentimosSiCero: true })} mil`;
  return formatMoney(euros * 100, { simbolo: false, sinCentimosSiCero: true });
}

/** Columnas agrupadas: ingresos y gastos por mes, con tooltip al pasar por cada mes. */
export function Bars({ datos, titulo }: { datos: Barra[]; titulo: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const alto = 220;
  const margen = { top: 12, right: 4, bottom: 28, left: 52 };
  const w = width - margen.left - margen.right;
  const h = alto - margen.top - margen.bottom;

  const maxCents = Math.max(1, ...datos.flatMap((d) => [d.ingresos, d.gastos]));
  const paso = pasoBonito(maxCents / 100);
  const tope = Math.max(paso, Math.ceil(maxCents / 100 / paso) * paso);
  const ticks = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
  const y = (cents: number) => h - (cents / 100 / tope) * h;

  const banda = w / datos.length;
  const barra = Math.min(24, (banda - 16) / 2);
  const colores = config.graficos;

  const radioArriba = (x: number, yTop: number, ancho: number, altura: number) => {
    if (altura <= 0) return '';
    const r = Math.min(4, ancho / 2, altura);
    return `M${x} ${yTop + altura}V${yTop + r}Q${x} ${yTop} ${x + r} ${yTop}H${x + ancho - r}Q${x + ancho} ${yTop} ${x + ancho} ${yTop + r}V${yTop + altura}Z`;
  };

  const d = hover !== null ? datos[hover] : null;

  return (
    <div>
      <div className="chart-legend" style={{ marginBottom: 12 }}>
        <span><span className="dot" style={{ background: colores.ingresos, borderRadius: 3 }} />Ingresos</span>
        <span><span className="dot" style={{ background: colores.gastos, borderRadius: 3 }} />Gastos</span>
      </div>
      <div className="chart-box" ref={ref}>
        <svg width={width} height={alto} role="img" aria-label={titulo}>
          <g transform={`translate(${margen.left},${margen.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={w} y1={y(t * 100)} y2={y(t * 100)} stroke="var(--line)" />
                <text x={-10} y={y(t * 100)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)" className="num">
                  {etiquetaEje(t)}
                </text>
              </g>
            ))}
            {datos.map((dato, i) => {
              const x0 = i * banda + banda / 2 - barra - 1;
              return (
                <g
                  key={dato.clave}
                  className="bar-group"
                  tabIndex={0}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${dato.etiqueta}: ingresos ${formatMoney(dato.ingresos)}, gastos ${formatMoney(dato.gastos)}`}
                >
                  <rect className="bar-hit" x={i * banda + 2} y={0} width={banda - 4} height={h} rx={8} />
                  <path d={radioArriba(x0, y(dato.ingresos), barra, h - y(dato.ingresos))} fill={colores.ingresos} />
                  <path d={radioArriba(x0 + barra + 2, y(dato.gastos), barra, h - y(dato.gastos))} fill={colores.gastos} />
                  <text x={i * banda + banda / 2} y={h + 19} textAnchor="middle" fontSize={12} fill={dato.destacada ? 'var(--text)' : 'var(--text-3)'} fontWeight={dato.destacada ? 600 : 400}>
                    {dato.etiqueta}
                  </text>
                </g>
              );
            })}
            <line x1={0} x2={w} y1={h} y2={h} stroke="var(--line-strong)" />
          </g>
        </svg>
        {d && hover !== null && (
          <div className="chart-tooltip" style={{ left: margen.left + hover * banda + banda / 2, top: margen.top + y(Math.max(d.ingresos, d.gastos)) }}>
            <div className="tt-title">{d.etiqueta}</div>
            <div className="tt-row"><span className="tt-key" style={{ background: colores.ingresos }} /><strong>{formatMoney(d.ingresos)}</strong> ingresos</div>
            <div className="tt-row"><span className="tt-key" style={{ background: colores.gastos }} /><strong>{formatMoney(d.gastos)}</strong> gastos</div>
          </div>
        )}
        <table className="sr-only">
          <caption>{titulo}</caption>
          <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th></tr></thead>
          <tbody>
            {datos.map((dato) => (
              <tr key={dato.clave}><td>{dato.etiqueta}</td><td>{formatMoney(dato.ingresos)}</td><td>{formatMoney(dato.gastos)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
