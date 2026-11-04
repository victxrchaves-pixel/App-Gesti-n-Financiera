import { useId, useRef, useState } from 'react';
import { formatMoney } from '../lib/money';
import { useWidth } from './useWidth';

export interface PuntoMensual {
  clave: string;
  etiqueta: string;
  nombre: string;
  ingresos: number;
  gastos: number;
  enCurso?: boolean;
}

/** Curvas entre meses sin sobrepasar los valores de sus extremos. */
function trazado(puntos: { x: number; y: number }[]): string {
  return puntos.map((p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const anterior = puntos[i - 1];
    const medio = (anterior.x + p.x) / 2;
    return `C${medio},${anterior.y} ${medio},${p.y} ${p.x},${p.y}`;
  }).join(' ');
}

/** Comparación mensual con selección táctil, por ratón y por teclado. */
export function LineChart({ datos, titulo }: { datos: PuntoMensual[]; titulo: string }) {
  const [ref, ancho] = useWidth<HTMLDivElement>();
  const gradiente = useId();
  const [seleccion, setSeleccion] = useState(datos.length - 1);
  const [hover, setHover] = useState<number | null>(null);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  if (!datos.length) return <div className="empty">Todavía no hay datos para este periodo.</div>;

  const indice = Math.min(Math.max(0, hover ?? seleccion), datos.length - 1);
  const dato = datos[indice];
  const alto = 210;
  const margen = { arriba: 18, abajo: 16, izquierda: 45, derecha: 12 };
  const w = Math.max(1, ancho - margen.izquierda - margen.derecha);
  const h = alto - margen.arriba - margen.abajo;
  const maximo = Math.max(100, ...datos.flatMap(d => [d.ingresos, d.gastos]));
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  const tope = Math.ceil(maximo / magnitud) * magnitud;
  const banda = w / datos.length;
  const x = (i: number) => margen.izquierda + banda * (i + 0.5);
  const y = (cents: number) => margen.arriba + h * (1 - cents / tope);
  const ingresos = datos.map((d, i) => ({ x: x(i), y: y(d.ingresos) }));
  const gastos = datos.map((d, i) => ({ x: x(i), y: y(d.gastos) }));
  const lineaIngresos = trazado(ingresos);
  const colores = { ingresos: 'var(--chart-income)', gastos: 'var(--chart-expense)' };
  const compacto = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });

  return (
    <div className="line-chart">
      <div className="chart-readout">
        <div className="chart-period">{dato.nombre}{dato.enCurso && <span> · En curso</span>}</div>
        <div className="chart-values">
          <div><span className="chart-key"><i style={{ background: colores.ingresos }} />Ingresos</span><strong>{formatMoney(dato.ingresos)}</strong></div>
          <div><span className="chart-key"><i className="key-expense" style={{ background: colores.gastos }} />Gastos</span><strong>{formatMoney(dato.gastos)}</strong></div>
        </div>
      </div>
      <div className="line-plot" ref={ref} role="group" aria-label={titulo}>
        <svg width="100%" height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true">
          <defs><linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colores.ingresos} stopOpacity="0.18" /><stop offset="100%" stopColor={colores.ingresos} stopOpacity="0" /></linearGradient></defs>
          {[0, 0.5, 1].map(fraccion => (
            <g key={fraccion}>
              <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={y(tope * fraccion)} y2={y(tope * fraccion)} stroke="var(--line)" strokeDasharray={fraccion ? '3 6' : undefined} />
              <text x={margen.izquierda - 10} y={y(tope * fraccion)} dy=".32em" textAnchor="end" fill="var(--text-3)" fontSize="10">{compacto.format(tope * fraccion / 100)}</text>
            </g>
          ))}
          <text x={margen.izquierda - 10} y="7" textAnchor="end" fill="var(--text-3)" fontSize="9">EUR</text>
          {datos.length > 1 && <path d={`${lineaIngresos} L${x(datos.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gradiente})`} />}
          <path className="trend-line" d={lineaIngresos} stroke={colores.ingresos} />
          <path className="trend-line trend-expense" d={trazado(gastos)} stroke={colores.gastos} strokeDasharray="4 5" />
          <line x1={x(indice)} x2={x(indice)} y1={margen.arriba} y2={y(0)} stroke="var(--line-strong)" strokeDasharray="3 5" />
          {datos.map((d, i) => (
            <g key={d.clave}>
              <circle cx={x(i)} cy={y(d.ingresos)} r={i === indice ? 5 : 2.8} fill="var(--card)" stroke={colores.ingresos} strokeWidth={2} />
              <rect x={x(i) - (i === indice ? 4 : 2.5)} y={y(d.gastos) - (i === indice ? 4 : 2.5)} width={i === indice ? 8 : 5} height={i === indice ? 8 : 5} rx="1.5" fill="var(--card)" stroke={colores.gastos} strokeWidth="1.5" />
            </g>
          ))}
        </svg>
        <div className="chart-targets" style={{ left: margen.izquierda, right: margen.derecha }}>
          {datos.map((d, i) => (
            <button
              type="button" key={d.clave} ref={el => { botones.current[i] = el; }}
              className={`chart-month${i === indice ? ' is-current' : ''}`}
              aria-label={`${d.nombre}: ingresos ${formatMoney(d.ingresos)}, gastos ${formatMoney(d.gastos)}`}
              aria-pressed={i === seleccion}
              onPointerEnter={e => { if (e.pointerType !== 'touch') setHover(i); }}
              onPointerLeave={() => setHover(null)}
              onFocus={() => { setHover(null); setSeleccion(i); }}
              onClick={() => { setHover(null); setSeleccion(i); }}
              onKeyDown={e => {
                let siguiente: number | undefined;
                if (e.key === 'ArrowRight') siguiente = Math.min(datos.length - 1, i + 1);
                if (e.key === 'ArrowLeft') siguiente = Math.max(0, i - 1);
                if (e.key === 'Home') siguiente = 0;
                if (e.key === 'End') siguiente = datos.length - 1;
                if (siguiente !== undefined) { e.preventDefault(); botones.current[siguiente]?.focus(); }
              }}
            ><span>{datos.length > 6 && ancho < 420 && i % 2 !== 0 && i !== datos.length - 1 ? '' : d.etiqueta}</span></button>
          ))}
        </div>
      </div>
      <p className="chart-hint">Toca un mes para ver el detalle.</p>
    </div>
  );
}
