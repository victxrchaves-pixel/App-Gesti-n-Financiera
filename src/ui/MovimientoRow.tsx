import { todayISO } from '../lib/dates';
import { colorCategoria } from '../config/neto.config';
import type { Categoria, Cuenta, Movimiento } from '../db/types';
import { formatMoney } from '../lib/money';
import { CategoryIcon } from './CategoryIcon';
import { iconoCategoria, reconocerIcono } from '../lib/iconos';

export function MovimientoRow({
  m,
  categorias,
  cuentas,
  onClick,
}: {
  m: Movimiento;
  categorias: Map<string, Categoria>;
  cuentas: Map<string, Cuenta>;
  onClick?: () => void;
}) {
  const cat = m.categoriaId ? categorias.get(m.categoriaId) : undefined;
  const cuenta = cuentas.get(m.cuentaId);
  const destino = m.cuentaDestinoId ? cuentas.get(m.cuentaDestinoId) : undefined;
  const nombreCuenta = (c: Cuenta | undefined) =>
    c?.cuentaPadreId
      ? `${cuentas.get(c.cuentaPadreId)?.nombre ?? 'Ahorro'} · ${c.nombre.replace(/^(Ahorro|Meta) · /, '')}`
      : c?.nombre;
  const esTransfer = m.tipo === 'transferencia';
  const titulo = m.nota || (esTransfer ? 'Transferencia' : (cat?.nombre ?? 'Sin categoría'));
  const sub = esTransfer
    ? `${nombreCuenta(cuenta) ?? '—'} → ${nombreCuenta(destino) ?? '—'}`
    : [
        m.devolucionDe ? 'Devolución' : m.reparto?.length ? 'Varias categorías' : m.nota ? cat?.nombre : null,
        nombreCuenta(cuenta),
      ]
        .filter(Boolean)
        .join(' · ');
  const catIcono = cat ?? (m.reparto?.length ? categorias.get(m.reparto[0].categoriaId) : undefined);
  const color = esTransfer ? 'var(--text-2)' : colorCategoria(catIcono?.color);
  // El concepto manda si se reconoce («Gimnasio» lleva mancuerna aunque la categoría sea Salud).
  const icono = esTransfer
    ? 'transferencia'
    : m.devolucionDe
      ? 'devolucion'
      : (reconocerIcono(m.nota) ??
        (catIcono ? iconoCategoria(catIcono) : m.tipo === 'ingreso' ? 'ingreso-extra' : 'otros'));

  return (
    <button type="button" className="list-row" onClick={onClick}>
      <CategoryIcon icono={icono} color={color} />
      <span className="row-main">
        <div className="row-title">{titulo}</div>
        <div className="row-sub">
          {sub}
          {cuenta?.eliminada ? ' · Cuenta eliminada' : ''}
          {m.fecha > todayISO() ? ' · Corregir fecha futura' : ''}
        </div>
      </span>
      <span
        className={`row-amount${m.tipo === 'ingreso' ? ' positive' : m.tipo === 'gasto' ? ' expense-text' : ''}${esTransfer ? ' faint' : ''}`}
      >
        {formatMoney(m.tipo === 'gasto' ? -Math.abs(m.importe) : Math.abs(m.importe), {
          signo: m.tipo === 'ingreso' ? 'siempre' : 'auto',
        })}
      </span>
    </button>
  );
}
