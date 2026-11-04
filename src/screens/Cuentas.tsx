import { useMemo, useState } from 'react';
import { config } from '../config/neto.config';
import { useAjustes, useCuentas, useMovimientos, useSaldos } from '../db/hooks';
import type { Ambito, Cuenta } from '../db/types';
import { patrimonio } from '../lib/balances';
import { formatMoney } from '../lib/money';
import { PageHeader } from '../layout/Shell';
import { CuentaForm } from '../ui/CuentaForm';
import { Icon } from '../ui/Icon';

const nombreTipo = (t: string) => config.tiposCuenta.find((x) => x.id === t)?.nombre ?? t;

function Tarjeta({ c, saldo, onClick }: { c: Cuenta; saldo: number; onClick: () => void }) {
  return (
    <button className="card account-card" onClick={onClick}>
      <span className="account-type"><Icon name={c.tipo} size={18} />{nombreTipo(c.tipo)}{c.archivada && <span className="tag tag-neutral">Archivada</span>}</span>
      <span className="account-name">{c.nombre}</span>
      <span className={`account-balance${saldo < 0 ? ' danger-text' : ''}`}>{formatMoney(saldo)}</span>
    </button>
  );
}

export function Cuentas() {
  const ajustes = useAjustes();
  const cuentas = useCuentas();
  const movimientos = useMovimientos();
  const saldos = useSaldos();
  const [form, setForm] = useState<{ cuenta?: Cuenta; ambito?: Ambito } | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  const autonomo = ajustes?.autonomo ?? false;

  const ambitos: Ambito[] = autonomo ? ['personal', 'negocio'] : ['personal'];
  const archivadas = cuentas.filter((c) => c.archivada && (autonomo || c.ambito === 'personal'));
  const totalPersonal = useMemo(() => patrimonio(cuentas, movimientos, 'personal'), [cuentas, movimientos]);
  const totalNegocio = useMemo(() => patrimonio(cuentas, movimientos, 'negocio'), [cuentas, movimientos]);

  return (
    <>
      <PageHeader
        titulo="Cuentas"
        acciones={<button className="btn btn-primary" onClick={() => setForm({})}><Icon name="mas" size={16} stroke={2.2} />Nueva cuenta</button>}
      />

      <div className="stack">
        <section className="card">
          <div className="eyebrow">{autonomo ? 'Patrimonio personal' : 'Patrimonio'}</div>
          <div className="big-number" style={{ marginBottom: autonomo ? 14 : 0 }}>{formatMoney(totalPersonal)}</div>
          {autonomo && (
            <div className="kpis">
              <div><div className="kpi-label">En cuentas del negocio</div><div className="kpi-value">{formatMoney(totalNegocio)}</div></div>
            </div>
          )}
        </section>

        {ambitos.map((ambito) => {
          const lista = cuentas.filter((c) => c.ambito === ambito && !c.archivada);
          return (
            <section key={ambito}>
              {autonomo && <h2 className="card-title" style={{ margin: '8px 4px 14px' }}>{ambito === 'personal' ? 'Personales' : 'Del negocio'}</h2>}
              {lista.length === 0 ? (
                <div className="card">
                  <div className="empty">
                    <div className="empty-title">{ambito === 'personal' ? 'Aún no tienes cuentas' : 'Sin cuentas del negocio'}</div>
                    <div>{ambito === 'personal' ? 'Añade tu banco, tu efectivo o tus ahorros con el saldo que tienen hoy.' : 'Añade la cuenta donde cobras tus facturas.'}</div>
                    <button className="btn btn-secondary" onClick={() => setForm({ ambito })}>Añadir cuenta</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-3">
                  {lista.map((c) => <Tarjeta key={c.id} c={c} saldo={saldos.get(c.id) ?? 0} onClick={() => setForm({ cuenta: c })} />)}
                </div>
              )}
            </section>
          );
        })}

        {archivadas.length > 0 && (
          <section>
            <button className="btn btn-ghost btn-sm" onClick={() => setVerArchivadas(!verArchivadas)}>
              {verArchivadas ? 'Ocultar' : 'Ver'} archivadas ({archivadas.length})
            </button>
            {verArchivadas && (
              <div className="grid grid-3" style={{ marginTop: 14 }}>
                {archivadas.map((c) => <Tarjeta key={c.id} c={c} saldo={saldos.get(c.id) ?? 0} onClick={() => setForm({ cuenta: c })} />)}
              </div>
            )}
          </section>
        )}
      </div>

      {form && <CuentaForm cuenta={form.cuenta} ambitoInicial={form.ambito} onClose={() => setForm(null)} />}
    </>
  );
}
