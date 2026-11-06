import { useMemo, useState } from 'react';
import { config } from '../config/neto.config';
import { useCuentas, useMapaCategorias, useMovimientos } from '../db/hooks';
import type { Cuenta, Movimiento, TipoMovimiento } from '../db/types';
import { flujoMes, grupoCuenta, serieSaldoDiaria } from '../lib/cuentas';
import { addDays, addMonths, monthKey, monthLabel, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { ordenarMovimientos } from '../lib/stats';
import { esRepartoInterno } from '../lib/balances';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { MovimientoForm } from './MovimientoForm';
import { MovimientoRow } from './MovimientoRow';
import { Segmented } from './Segmented';
import { ValueChart } from './ValueChart';

const RANGOS = [
  { valor: '1M', texto: '1M', dias: 30 },
  { valor: '3M', texto: '3M', dias: 90 },
  { valor: '1A', texto: '1A', dias: 365 },
] as const;
type Rango = (typeof RANGOS)[number]['valor'];
const MESES_FLUJO = 6;
const ULTIMOS = 6;

/** Ficha de una cuenta: evolución de su saldo, lo que entra y sale cada mes y sus últimos movimientos. */
export function CuentaDetalle({
  cuenta,
  saldo,
  onEditar,
  onClose,
}: {
  cuenta: Cuenta;
  saldo: number;
  onEditar: () => void;
  onClose: () => void;
}) {
  const cuentas = useCuentas();
  const movimientos = useMovimientos();
  const categorias = useMapaCategorias();
  const [rango, setRango] = useState<Rango>('3M');
  const [nuevo, setNuevo] = useState<{ tipo?: TipoMovimiento; movimiento?: Movimiento } | null>(null);
  const hoy = todayISO();
  const ids = useMemo(() => grupoCuenta(cuenta.id, cuentas), [cuenta.id, cuentas]);
  const mapaCuentas = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas]);
  const dias = RANGOS.find((r) => r.valor === rango)!.dias;
  const serie = useMemo(
    () =>
      serieSaldoDiaria(ids, cuentas, movimientos, addDays(hoy, -dias), hoy).map((p) => ({
        fecha: p.fecha,
        valor: p.valor / 100,
      })),
    [ids, cuentas, movimientos, dias, hoy],
  );
  const flujos = useMemo(
    () =>
      Array.from({ length: MESES_FLUJO }, (_, i) => addMonths(monthKey(hoy), -i)).map((mes) => ({
        mes,
        ...flujoMes(ids, movimientos, mes, hoy),
      })),
    [ids, movimientos, hoy],
  );
  const maxFlujo = Math.max(1, ...flujos.flatMap((f) => [f.entradas, f.salidas]));
  const grupo = new Set(ids);
  const ultimos = ordenarMovimientos(
    movimientos.filter(
      (m) =>
        m.fecha <= hoy &&
        (grupo.has(m.cuentaId) || (m.cuentaDestinoId !== undefined && grupo.has(m.cuentaDestinoId))) &&
        !esRepartoInterno(m, mapaCuentas),
    ),
  ).slice(0, ULTIMOS);
  const tipo = config.tiposCuenta.find((t) => t.id === cuenta.tipo)?.nombre ?? cuenta.tipo;

  return (
    <>
      <Modal titulo={cuenta.nombre} onClose={onClose}>
        <div className="modal-body account-detail">
          <div className="account-detail-head">
            <span className="account-detail-icon">
              <Icon name={cuenta.ahorroGeneral ? 'ahorro' : cuenta.tipo} size={22} />
            </span>
            <div>
              <div className="muted">
                {cuenta.ahorroGeneral ? 'Ahorro general · incluye tus metas' : tipo} ·{' '}
                {cuenta.ambito === 'negocio' ? 'Negocio' : 'Personal'}
              </div>
              <div className={`account-detail-balance${saldo < 0 ? ' danger-text' : ''}`}>{formatMoney(saldo)}</div>
            </div>
          </div>

          <div className="account-detail-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setNuevo({ tipo: 'gasto' })}>
              <Icon name="mas" size={15} /> Movimiento
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setNuevo({ tipo: 'transferencia' })}>
              <Icon name="transferencia" size={15} /> Transferir
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onEditar}>
              <Icon name="editar" size={15} /> Editar cuenta
            </button>
          </div>

          <section>
            <div className="account-detail-section-head">
              <h3 className="card-title">Evolución del saldo</h3>
              <Segmented opciones={RANGOS} valor={rango} onChange={setRango} etiqueta="Periodo" />
            </div>
            <ValueChart
              key={rango}
              datos={serie}
              etiqueta={`Saldo de ${cuenta.nombre}`}
              etiquetaValor="Saldo ese día"
            />
          </section>

          <section>
            <h3 className="card-title">Lo que entra y sale</h3>
            <div className="account-flows">
              {flujos.map((f) => (
                <div className="account-flow" key={f.mes}>
                  <span className="account-flow-month">
                    {monthLabel(f.mes, false).replace(/^./, (c) => c.toUpperCase())}
                  </span>
                  <span className="account-flow-bars" aria-hidden="true">
                    <i className="is-in" style={{ width: `${(f.entradas / maxFlujo) * 100}%` }} />
                    <i className="is-out" style={{ width: `${(f.salidas / maxFlujo) * 100}%` }} />
                  </span>
                  <span className="account-flow-values">
                    <span className={f.entradas ? 'income-text' : 'faint'}>
                      {formatMoney(f.entradas, { signo: 'siempre' })}
                    </span>
                    <span className={f.salidas ? 'expense-text' : 'faint'}>{formatMoney(-f.salidas)}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="card-title">Últimos movimientos</h3>
            {ultimos.length ? (
              <div className="list">
                {ultimos.map((m) => (
                  <MovimientoRow
                    key={m.id}
                    m={m}
                    categorias={categorias}
                    cuentas={mapaCuentas}
                    onClick={() => setNuevo({ movimiento: m })}
                  />
                ))}
              </div>
            ) : (
              <p className="field-hint">Esta cuenta aún no tiene movimientos.</p>
            )}
          </section>
        </div>
      </Modal>
      {nuevo && (
        <MovimientoForm
          movimiento={nuevo.movimiento}
          tipoInicial={nuevo.tipo}
          cuentaPreferida={cuenta.ahorroGeneral ? undefined : cuenta.id}
          onClose={() => setNuevo(null)}
        />
      )}
    </>
  );
}
