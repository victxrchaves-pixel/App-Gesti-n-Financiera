import type { ReactNode } from 'react';
import { formatMoney } from '../lib/money';
import { Icon, type IconName } from './Icon';

/** Importe protagonista: los euros grandes y los céntimos más pequeños («9.864» «,74 €»). */
export function ImporteGrande({ cents, className = '' }: { cents: number; className?: string }) {
  const texto = formatMoney(cents);
  const coma = texto.lastIndexOf(',');
  return (
    <span className={`big-amount ${className}`.trim()} aria-label={texto}>
      <span aria-hidden="true">{coma > 0 ? texto.slice(0, coma) : texto}</span>
      {coma > 0 && <small aria-hidden="true">{texto.slice(coma)}</small>}
    </span>
  );
}

export interface Accion {
  icono: IconName;
  texto: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}

/** Fila de botones redondos con su texto debajo, para las acciones principales de un inicio. */
export function AccionesRedondas({ acciones }: { acciones: readonly Accion[] }) {
  return (
    <div className="round-actions">
      {acciones.map((a) => {
        const contenido = (
          <>
            <span className="round-action-icon" aria-hidden="true">
              <Icon name={a.icono} size={22} stroke={2} />
            </span>
            <span className="round-action-text">{a.texto}</span>
          </>
        );
        return a.href ? (
          <a key={a.texto} className="round-action" href={a.href}>
            {contenido}
          </a>
        ) : (
          <button key={a.texto} type="button" className="round-action" onClick={a.onClick} disabled={a.disabled}>
            {contenido}
          </button>
        );
      })}
    </div>
  );
}

/** Tarjeta blanca con título, enlace opcional («Ver todos») y su contenido agrupado. */
export function TarjetaLista({
  titulo,
  enlace,
  children,
  className = '',
}: {
  titulo: string;
  enlace?: { texto: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`list-card ${className}`.trim()}>
      <div className="list-card-header">
        <h2>{titulo}</h2>
        {enlace && (
          <a className="list-card-link" href={enlace.href}>
            {enlace.texto}
          </a>
        )}
      </div>
      {children}
    </section>
  );
}
