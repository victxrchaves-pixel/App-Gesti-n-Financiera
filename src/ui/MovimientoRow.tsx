import { todayISO } from '../lib/dates';
import { colorCategoria } from '../config/neto.config';
import type { Categoria, Cuenta, Movimiento } from '../db/types';
import { formatMoney } from '../lib/money';
import { Icon } from './Icon';

export function MovimientoRow({
  m, categorias, cuentas, onClick,
}: {
  m: Movimiento;
  categorias: Map<string, Categoria>;
  cuentas: Map<string, Cuenta>;
  onClick?: () => void;
}) {
  const cat = m.categoriaId ? categorias.get(m.categoriaId) : undefined;
  const cuenta = cuentas.get(m.cuentaId);
  const destino = m.cuentaDestinoId ? cuentas.get(m.cuentaDestinoId) : undefined;
  const esTransfer = m.tipo === 'transferencia';
  const titulo = m.nota || (esTransfer ? 'Transferencia' : cat?.nombre ?? 'Sin categoría');
  const sub = esTransfer
    ? `${cuenta?.nombre ?? '—'} → ${destino?.nombre ?? '—'}`
    : [m.nota ? cat?.nombre : null, cuenta?.nombre].filter(Boolean).join(' · ');
  const color = esTransfer ? 'var(--text-3)' : colorCategoria(cat?.color);

  return (
    <button type="button" className="list-row" onClick={onClick}>
      <span className="row-icon" style={{ background: color }}>
        {esTransfer ? <Icon name="transferencia" size={18} stroke={2} /> : <Icon name={m.tipo} size={18} stroke={2} />}
      </span>
      <span className="row-main">
        <div className="row-title">{titulo}</div>
        <div className="row-sub">{sub}{cuenta?.eliminada?' · Cuenta eliminada':''}{m.fecha>todayISO()?' · Corregir fecha futura':''}</div>
      </span>
      <span className={`row-amount${m.tipo === 'ingreso' ? ' positive' : m.tipo === 'gasto' ? ' expense-text' : ''}${esTransfer ? ' faint' : ''}`}>
        {formatMoney(m.tipo === 'gasto' ? -m.importe : m.importe, { signo: m.tipo === 'ingreso' ? 'siempre' : 'auto' })}
      </span>
    </button>
  );
}
