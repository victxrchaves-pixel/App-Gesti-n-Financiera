import { useMemo, useState } from 'react';
import { config } from '../config/neto.config';
import { useCuentas, useMapaCategorias, useMetas, useMovimientos, useSaldos } from '../db/hooks';
import { useEspacio } from '../ui/Espacio';
import type { Ambito, Categoria, Cuenta, Movimiento } from '../db/types';
import { patrimonio } from '../lib/balances';
import {
  cuentasPatrimonio,
  flujoMes,
  grupoCuenta,
  patrimonioMensual,
  serieSaldoDiaria,
  ultimoMovimiento,
} from '../lib/cuentas';
import { addDays, dayHeader, monthKey, monthShortLabel, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { PageHeader } from '../layout/Shell';
import { CuentaDetalle } from '../ui/CuentaDetalle';
import { CuentaForm } from '../ui/CuentaForm';
import { Icon } from '../ui/Icon';
import { Sparkline } from '../ui/Sparkline';
import { TrendChart } from '../ui/TrendChart';

/** Días de la mini gráfica de cada cuenta y meses de la evolución del patrimonio. */
const DIAS_MINI = 30;
const MESES_EVOLUCION = 6;

/** Lo que da vida a cada tarjeta: su saldo reciente, lo que entra y sale este mes y su último movimiento. */
interface ResumenCuenta {
  serie: { fecha: string; precioEUR: number }[];
  entradas: number;
  salidas: number;
  ultimo?: Movimiento;
}

function PieTarjeta({ r, categorias, hoy }: { r: ResumenCuenta; categorias: Map<string, Categoria>; hoy: string }) {
  const u = r.ultimo;
  const texto = u ? u.nota || (u.categoriaId ? categorias.get(u.categoriaId)?.nombre : null) || 'Transferencia' : null;
  return (
    <span className="account-extra">
      <span className="account-extra-row">
        <span className="account-month">
          <span className={r.entradas ? 'income-text' : 'faint'}>{formatMoney(r.entradas, { signo: 'siempre' })}</span>
          <span className={r.salidas ? 'expense-text' : 'faint'}>{formatMoney(-r.salidas)}</span>
          <small>este mes</small>
        </span>
        <Sparkline puntos={r.serie} dias={DIAS_MINI} width={84} height={30} />
      </span>
      <span className="account-last">
        {u ? (
          <>
            <span className="account-last-name">{texto}</span>
            <span>{dayHeader(u.fecha, hoy)}</span>
          </>
        ) : (
          <span>Sin movimientos todavía</span>
        )}
      </span>
    </span>
  );
}

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
  resumen,
  categorias,
  hoy,
}: {
  c: Cuenta;
  saldo: number;
  onClick: () => void;
  metasDentro: number;
  resumen: ResumenCuenta;
  categorias: Map<string, Categoria>;
  hoy: string;
}) {
  if (c.ahorroGeneral)
    return (
      <div className={claseCapas(metasDentro)}>
        <section className="card account-card wallet-card savings-account-card">
          <button className="wallet-main" onClick={onClick} aria-label={`Ver la cuenta ${c.nombre}`}>
            <span className="account-type">
              <Icon name="ahorro" size={18} />
              Ahorro general
            </span>
            <span className="account-name">{c.nombre}</span>
            <span className="wallet-caption">Todo tu ahorro, incluidas las metas</span>
            <span className={`account-balance${saldo < 0 ? ' danger-text' : ''}`}>{formatMoney(saldo)}</span>
            <PieTarjeta r={resumen} categorias={categorias} hoy={hoy} />
          </button>
          <div className="wallet-footer">
            <button type="button" className="wallet-footer-link" onClick={onClick}>
              Ver detalle
            </button>
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
        <PieTarjeta r={resumen} categorias={categorias} hoy={hoy} />
        <span className="wallet-footer">
          Ver detalle
          <Icon name="flecha" size={18} />
        </span>
      </button>
    </div>
  );
}

export function Cuentas() {
  const espacio = useEspacio();
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
  const [detalle, setDetalle] = useState<string | null>(null);
  const categorias = useMapaCategorias();
  const hoy = todayISO();
  const mes = monthKey(hoy);
  const visibles = useMemo(() => cuentas.filter((c) => !c.archivada && !c.cuentaPadreId), [cuentas]);
  const resumenes = useMemo(() => {
    const out = new Map<string, ResumenCuenta>();
    for (const c of visibles) {
      const ids = grupoCuenta(c.id, cuentas);
      const f = flujoMes(ids, movimientos, mes, hoy);
      out.set(c.id, {
        serie: serieSaldoDiaria(ids, cuentas, movimientos, addDays(hoy, -DIAS_MINI), hoy).map((p) => ({
          fecha: p.fecha,
          precioEUR: p.valor / 100,
        })),
        entradas: f.entradas,
        salidas: f.salidas,
        ultimo: ultimoMovimiento(ids, movimientos, hoy),
      });
    }
    return out;
  }, [visibles, cuentas, movimientos, mes, hoy]);
  const evolucion = useMemo(
    () => patrimonioMensual(cuentas, movimientos, mes, MESES_EVOLUCION, hoy, espacio),
    [cuentas, movimientos, mes, hoy, espacio],
  );
  const cambioMes =
    evolucion.length > 1 ? evolucion[evolucion.length - 1].valor - evolucion[evolucion.length - 2].valor : 0;
  const reparto = useMemo(() => {
    const r = { uso: 0, ahorro: 0, efectivo: 0 };
    for (const c of cuentasPatrimonio(cuentas, espacio)) {
      const saldo = saldos.get(c.id) ?? 0;
      if (c.tipo === 'ahorro') r.ahorro += saldo;
      else if (c.tipo === 'efectivo') r.efectivo += saldo;
      else r.uso += saldo;
    }
    return r;
  }, [cuentas, saldos, espacio]);
  const cuentaDetalle = detalle ? cuentas.find((c) => c.id === detalle) : undefined;

  const negocio = espacio === 'negocio';
  const total = useMemo(() => patrimonio(cuentas, movimientos, espacio), [cuentas, movimientos, espacio]);

  return (
    <>
      <PageHeader
        titulo="Cuentas"
        acciones={
          <button className="btn btn-primary" onClick={() => setForm({ ambito: espacio })}>
            <Icon name="mas" size={16} stroke={2.2} />
            Nueva cuenta
          </button>
        }
      />

      <div className="stack">
        <section className="card accounts-hero">
          <div className="accounts-hero-main">
            <div className="eyebrow">{negocio ? 'Dinero del negocio' : 'Patrimonio'}</div>
            <div className="big-number">{formatMoney(total)}</div>
            <span className={`gain-chip ${cambioMes >= 0 ? 'is-up' : 'is-down'}`}>
              {cambioMes >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(cambioMes))} este mes
            </span>
            <div className="accounts-hero-split">
              <div>
                <span>Uso diario</span>
                <b>{formatMoney(reparto.uso)}</b>
              </div>
              {(!negocio || reparto.ahorro !== 0) && (
                <div>
                  <span>Ahorro</span>
                  <b>{formatMoney(reparto.ahorro)}</b>
                </div>
              )}
              {(!negocio || reparto.efectivo !== 0) && (
                <div>
                  <span>Efectivo</span>
                  <b>{formatMoney(reparto.efectivo)}</b>
                </div>
              )}
            </div>
          </div>
          <div className="accounts-hero-chart">
            <span className="eyebrow">Últimos {MESES_EVOLUCION} meses</span>
            <TrendChart
              puntos={evolucion.map((e) => ({ etiqueta: monthShortLabel(e.mes), valor: e.valor }))}
              titulo={`Evolución ${negocio ? 'del dinero del negocio' : 'del patrimonio'} en los últimos ${MESES_EVOLUCION} meses`}
            />
          </div>
        </section>

        {(() => {
          const lista = cuentas.filter((c) => c.ambito === espacio && !c.archivada && !c.cuentaPadreId);
          return lista.length === 0 ? (
            <div className="card">
              <div className="empty">
                <div className="empty-title">
                  {negocio ? 'Aún no tienes cuentas del negocio' : 'Aún no tienes cuentas'}
                </div>
                <div>
                  {negocio
                    ? 'Añade la cuenta donde cobras tus facturas y pagas los gastos del negocio.'
                    : 'Añade tu banco, tu efectivo o tus ahorros con el saldo que tienen hoy.'}
                </div>
                <button className="btn btn-secondary" onClick={() => setForm({ ambito: espacio })}>
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
                  onClick={() => setDetalle(c.id)}
                  resumen={resumenes.get(c.id) ?? { serie: [], entradas: 0, salidas: 0 }}
                  categorias={categorias}
                  hoy={hoy}
                  metasDentro={metas.filter((m) => m.activa && bolsillos.get(m.cuentaAhorroId ?? '') === c.id).length}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {cuentaDetalle && (
        <CuentaDetalle
          cuenta={cuentaDetalle}
          saldo={saldos.get(cuentaDetalle.id) ?? 0}
          onEditar={() => {
            setDetalle(null);
            setForm({ cuenta: cuentaDetalle });
          }}
          onClose={() => setDetalle(null)}
        />
      )}
      {form && <CuentaForm cuenta={form.cuenta} ambitoInicial={form.ambito} onClose={() => setForm(null)} />}
    </>
  );
}
