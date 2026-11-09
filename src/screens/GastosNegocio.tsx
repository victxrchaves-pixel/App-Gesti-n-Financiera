import { useMemo, useState } from 'react';
import { PageHeader } from '../layout/Shell';
import { useAjustes, useCuentas, useGastosNegocio } from '../db/hooks';
import { csvGastos } from '../lib/exportar';
import { guardarArchivo } from '../lib/platform';
import { useToast } from '../ui/Modal';
import type { GastoNegocio } from '../db/types';
import { shortDate, todayISO } from '../lib/dates';
import {
  enTrimestre,
  moverTrimestre,
  nombreTrimestre,
  perfilNegocio,
  trimestreDe,
  type Trimestre,
} from '../lib/facturas';
import {
  CATEGORIAS_GASTO,
  aniosDeReparto,
  categoriaGasto,
  cifrasGasto,
  gastoIRPFEnPeriodo,
  gastoIRPFPeriodo,
  resumirGastos,
} from '../lib/gastosNegocio';
import { finTrimestre, inicioTrimestre } from '../lib/impuestos';
import { formatMoney } from '../lib/money';
import { contar } from '../lib/plural';
import { GastoNegocioForm } from '../ui/GastoNegocioForm';
import { Icon } from '../ui/Icon';

const pct = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;

function FilaGasto({ g, hoy, abrir }: { g: GastoNegocio; hoy: string; abrir: () => void }) {
  const c = categoriaGasto(g.categoria);
  const cifras = cifrasGasto(g);
  // Sin IVA en la factura (seguros, comisiones), solo importa el IRPF.
  const deducible =
    g.cuotaIVA === 0
      ? g.deducibleIRPF === 100
        ? 'Deducible entero'
        : `Deducible al ${pct(g.deducibleIRPF)}`
      : g.deducibleIVA === 100 && g.deducibleIRPF === 100
        ? 'Deducible entero'
        : g.deducibleIVA === g.deducibleIRPF
          ? `Deducible al ${pct(g.deducibleIRPF)}`
          : `IVA ${pct(g.deducibleIVA)} · IRPF ${pct(g.deducibleIRPF)}`;
  const etiqueta = g.amortizacion ? `Se reparte en ${aniosDeReparto(g.amortizacion)} años` : deducible;
  return (
    <li className="invoice-row">
      <button type="button" className="invoice-row-main" onClick={abrir}>
        <span className="invoice-row-icon" aria-hidden="true">
          <Icon name={c.icono} size={18} />
        </span>
        <span className="invoice-row-text">
          <span className="invoice-row-title">
            <strong>{g.proveedor}</strong>
            {g.concepto && <span className="faint expense-concept">{g.concepto}</span>}
          </span>
          <span className="invoice-row-sub">
            {shortDate(g.fecha, hoy)} · {c.nombre}
          </span>
        </span>
        <span className="invoice-row-amount">
          <strong>{formatMoney(-cifras.total)}</strong>
          <span
            className={`invoice-status${g.deducibleIRPF === 0 && (g.deducibleIVA === 0 || g.cuotaIVA === 0) ? ' is-vencida' : ''}`}
          >
            {g.deducibleIRPF === 0 && (g.deducibleIVA === 0 || g.cuotaIVA === 0) ? 'No deducible' : etiqueta}
          </span>
        </span>
      </button>
    </li>
  );
}

export function GastosNegocio() {
  const gastos = useGastosNegocio();
  const cuentas = useCuentas();
  const avisar = useToast();
  const ajustes = useAjustes();
  const perfil = perfilNegocio(ajustes?.negocio);
  const hoy = todayISO();
  const [trimestre, setTrimestre] = useState<Trimestre>(() => trimestreDe(hoy));
  const [categoria, setCategoria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState<{ gasto?: GastoNegocio } | null>(null);

  const delTrimestre = useMemo(() => gastos.filter((g) => enTrimestre(g.fecha, trimestre)), [gastos, trimestre]);
  const resumen = resumirGastos(delTrimestre);
  // En el IRPF, el equipo caro cuenta repartido: lo que toca a este trimestre, aunque se comprara antes.
  const irpfTrimestre = gastoIRPFPeriodo(gastos, inicioTrimestre(trimestre), finTrimestre(trimestre));

  // Se exportan los gastos del trimestre y el equipo comprado antes que todavía se está repartiendo.
  const desde = inicioTrimestre(trimestre);
  const hasta = finTrimestre(trimestre);
  const paraExportar = gastos.filter(
    (g) => enTrimestre(g.fecha, trimestre) || (g.amortizacion && gastoIRPFEnPeriodo(g, desde, hasta) > 0),
  );
  const exportar = async () => {
    const mapa = new Map(cuentas.map((c) => [c.id, c]));
    const ok = await guardarArchivo(
      `neto-gastos-${trimestre.anio}-T${trimestre.t}.csv`,
      csvGastos(paraExportar, mapa, desde, hasta),
      { descripcion: 'Hoja de cálculo (CSV)', extension: 'csv', tipoMime: 'text/csv;charset=utf-8' },
    );
    if (ok) avisar(contar(paraExportar.length, 'gasto exportado', 'gastos exportados'));
  };

  const q = busqueda.trim().toLocaleLowerCase('es-ES');
  const buscando = q.length > 0;
  const lista = (buscando ? gastos : delTrimestre).filter((g) => {
    if (categoria && g.categoria !== categoria) return false;
    if (!q) return true;
    return [g.proveedor, g.concepto, g.numero, g.nota, categoriaGasto(g.categoria).nombre].some((t) =>
      t.toLocaleLowerCase('es-ES').includes(q),
    );
  });

  return (
    <>
      <PageHeader
        titulo="Gastos"
        subtitulo="Las facturas y tickets de tu negocio, con lo que puedes deducir de cada uno."
        acciones={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => void exportar()}
              disabled={paraExportar.length === 0}
              title={paraExportar.length === 0 ? 'No hay gastos en este trimestre' : undefined}
            >
              <Icon name="descargar" size={16} />
              Exportar
            </button>
            <button className="btn btn-primary" onClick={() => setForm({})}>
              <Icon name="mas" size={16} />
              Registrar gasto
            </button>
          </>
        }
      />

      <div className="toolbar">
        {!buscando && (
          <div className="month-nav">
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setTrimestre(moverTrimestre(trimestre, -1))}
              aria-label="Trimestre anterior"
            >
              <Icon name="izquierda" size={18} />
            </button>
            <span className="label">{nombreTrimestre(trimestre).replace(/^./, (c) => c.toUpperCase())}</span>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setTrimestre(moverTrimestre(trimestre, 1))}
              aria-label="Trimestre siguiente"
            >
              <Icon name="derecha" size={18} />
            </button>
          </div>
        )}
        <select
          className="select"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          aria-label="Categoría"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS_GASTO.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <input
          className="input input-search"
          placeholder="Buscar"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar en todos los gastos"
        />
      </div>

      {gastos.length > 0 && (
        <section className="recurring-summary invoice-summary" aria-label="Resumen de gastos">
          <div>
            <span className="summary-icon">
              <Icon name="gastos" size={20} />
            </span>
            <span>Gastado en el trimestre</span>
            <strong>{formatMoney(resumen.total)}</strong>
            <small>{contar(resumen.gastos, 'gasto', 'gastos')} · con IVA</small>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="impuestos" size={20} />
            </span>
            <span>IVA que puedes deducir</span>
            <strong>{formatMoney(resumen.ivaDeducible)}</strong>
            <small>Se resta del IVA que cobras en el 303.</small>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="cuentas" size={20} />
            </span>
            <span>Gasto deducible en el IRPF</span>
            <strong>{formatMoney(irpfTrimestre)}</strong>
            <small>
              {perfil.cuotaMensual > 0
                ? `Más tu cuota de autónomos, ${formatMoney(perfil.cuotaMensual)} al mes.`
                : 'Baja el beneficio por el que pagas IRPF.'}
            </small>
          </div>
        </section>
      )}

      <div className="card invoice-list-card">
        {lista.length === 0 ? (
          <div className="empty">
            <div className="empty-title">
              {buscando
                ? 'Ningún gasto coincide con la búsqueda'
                : gastos.length === 0
                  ? 'Aún no has registrado gastos del negocio'
                  : categoria
                    ? 'No hay gastos de esta categoría en este trimestre'
                    : 'No hay gastos en este trimestre'}
            </div>
            {gastos.length === 0 && (
              <>
                <div>
                  Apunta cada factura o ticket del negocio: Neto separa el IVA que recuperas y lo que cuenta como gasto
                  en el IRPF.
                </div>
                <button className="btn btn-primary" onClick={() => setForm({})}>
                  <Icon name="mas" size={16} />
                  Registrar el primero
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="invoice-list">
            {lista.map((g) => (
              <FilaGasto key={g.id} g={g} hoy={hoy} abrir={() => setForm({ gasto: g })} />
            ))}
          </ul>
        )}
      </div>

      {form && <GastoNegocioForm gasto={form.gasto} onClose={() => setForm(null)} />}
    </>
  );
}
