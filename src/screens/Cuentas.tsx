import { useMemo, useState } from 'react';
import { config } from '../config/neto.config';
import { useAjustes, useCuentas, useMetas, useMovimientos, useSaldos } from '../db/hooks';
import type { Ambito, Cuenta } from '../db/types';
import { patrimonio } from '../lib/balances';
import { formatMoney } from '../lib/money';
import { PageHeader } from '../layout/Shell';
import { CuentaForm } from '../ui/CuentaForm';
import { Icon } from '../ui/Icon';

const nombreTipo = (t: string) => config.tiposCuenta.find((x) => x.id === t)?.nombre ?? t;

/**
 * Las capas detrás de una tarjeta indican que dentro hay más cosas. Solo las tiene la cuenta
 * de ahorro, y tantas como metas guarda (una o dos capas como máximo).
 */
function claseCapas(metasDentro: number) {
  return `wallet-stack ${metasDentro >= 2 ? 'capas-2' : metasDentro === 1 ? 'capas-1' : 'sin-capas'}`;
}

function Tarjeta({
  c,
  saldo,
  onClick,
  metasDentro,
}: {
  c: Cuenta;
  saldo: number;
  onClick: () => void;
  metasDentro: number;
}) {
  if (c.ahorroGeneral)
    return (
      <div className={claseCapas(metasDentro)}>
        <section className="card account-card wallet-card savings-account-card">
          <button className="wallet-main" onClick={onClick} aria-label={`Editar cuenta ${c.nombre}`}>
            <span className="account-type">
              <Icon name="ahorro" size={18} />
              Ahorro general
            </span>
            <span className="account-name">{c.nombre}</span>
            <span className="wallet-caption">Todo tu ahorro, incluidas las metas</span>
            <span className={`account-balance${saldo < 0 ? ' danger-text' : ''}`}>{formatMoney(saldo)}</span>
          </button>
          <div className="wallet-footer">
            <span>Personal</span>
            <a href="#/metas">
              Ver metas <Icon name="flecha" size={18} />
            </a>
          </div>
        </section>
      </div>
    );
  return (
    <div className={claseCapas(0)}>
      <button className="card account-card wallet-card" onClick={onClick}>
        <span className="account-type">
          <Icon name={c.tipo} size={18} />
          {nombreTipo(c.tipo)}
        </span>
        <span className="account-name">{c.nombre}</span>
        <span className="wallet-caption">Saldo disponible</span>
        <span className={`account-balance${saldo < 0 ? ' danger-text' : ''}`}>{formatMoney(saldo)}</span>
        <span className="wallet-footer">
          {c.ambito === 'negocio' ? 'Negocio' : 'Personal'}
          <Icon name="flecha" size={18} />
        </span>
      </button>
    </div>
  );
}

export function Cuentas() {
  const ajustes = useAjustes();
  const cuentas = useCuentas().filter((c) => !c.eliminada);
  const movimientos = useMovimientos();
  const saldos = useSaldos();
  const metas = useMetas();
  // Bolsillo interno de cada meta → cuenta de ahorro visible a la que pertenece.
  const bolsillos = useMemo(
    () => new Map(cuentas.filter((c) => c.cuentaPadreId && c.bolsilloMetaId).map((c) => [c.id, c.cuentaPadreId!])),
    [cuentas],
  );
  const [form, setForm] = useState<{ cuenta?: Cuenta; ambito?: Ambito } | null>(null);

  const autonomo = ajustes?.autonomo ?? false;

  const ambitos: Ambito[] = autonomo ? ['personal', 'negocio'] : ['personal'];

  const totalPersonal = useMemo(() => patrimonio(cuentas, movimientos, 'personal'), [cuentas, movimientos]);
  const totalNegocio = useMemo(() => patrimonio(cuentas, movimientos, 'negocio'), [cuentas, movimientos]);

  return (
    <>
      <PageHeader
        titulo="Cuentas"
        acciones={
          <button className="btn btn-primary" onClick={() => setForm({})}>
            <Icon name="mas" size={16} stroke={2.2} />
            Nueva cuenta
          </button>
        }
      />

      <div className="stack">
        <section className="card card-inverse">
          <div className="eyebrow">{autonomo ? 'Patrimonio personal' : 'Patrimonio'}</div>
          <div className="big-number" style={{ marginBottom: autonomo ? 14 : 0 }}>
            {formatMoney(totalPersonal)}
          </div>
          {autonomo && (
            <div className="kpis">
              <div>
                <div className="kpi-label">En cuentas del negocio</div>
                <div className="kpi-value">{formatMoney(totalNegocio)}</div>
              </div>
            </div>
          )}
        </section>

        {ambitos.map((ambito) => {
          const lista = cuentas.filter((c) => c.ambito === ambito && !c.archivada && !c.cuentaPadreId);
          return (
            <section key={ambito}>
              {autonomo && (
                <h2 className="card-title" style={{ margin: '8px 4px 14px' }}>
                  {ambito === 'personal' ? 'Personales' : 'Del negocio'}
                </h2>
              )}
              {lista.length === 0 ? (
                <div className="card">
                  <div className="empty">
                    <div className="empty-title">
                      {ambito === 'personal' ? 'Aún no tienes cuentas' : 'Sin cuentas del negocio'}
                    </div>
                    <div>
                      {ambito === 'personal'
                        ? 'Añade tu banco, tu efectivo o tus ahorros con el saldo que tienen hoy.'
                        : 'Añade la cuenta donde cobras tus facturas.'}
                    </div>
                    <button className="btn btn-secondary" onClick={() => setForm({ ambito })}>
                      Añadir cuenta
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-3">
                  {lista.map((c) => (
                    <Tarjeta
                      key={c.id}
                      c={c}
                      saldo={saldos.get(c.id) ?? 0}
                      onClick={() => setForm({ cuenta: c })}
                      metasDentro={
                        metas.filter((m) => m.activa && bolsillos.get(m.cuentaAhorroId ?? '') === c.id).length
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {form && <CuentaForm cuenta={form.cuenta} ambitoInicial={form.ambito} onClose={() => setForm(null)} />}
    </>
  );
}
