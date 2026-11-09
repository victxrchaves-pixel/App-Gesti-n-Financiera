import { useMemo, useState } from 'react';
import { PageHeader } from '../layout/Shell';
import { useAjustes, useClientes, useFacturas } from '../db/hooks';
import { csvFacturas } from '../lib/exportar';
import { guardarArchivo } from '../lib/platform';
import { useToast } from '../ui/Modal';
import type { Factura } from '../db/types';
import { shortDate, todayISO } from '../lib/dates';
import {
  enTrimestre,
  estadoFactura,
  moverTrimestre,
  nombreTrimestre,
  perfilNegocio,
  resumirFacturas,
  totalesFactura,
  trimestreDe,
  type Trimestre,
} from '../lib/facturas';
import { formatMoney } from '../lib/money';
import { contar } from '../lib/plural';
import { ClientesModal } from '../ui/ClientesModal';
import { CobroForm } from '../ui/CobroForm';
import { FacturaForm } from '../ui/FacturaForm';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';

const FILTROS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'pendientes', texto: 'Pendientes' },
  { valor: 'cobradas', texto: 'Cobradas' },
] as const;
type Filtro = (typeof FILTROS)[number]['valor'];

function FilaFactura({ f, hoy, abrir, cobrar }: { f: Factura; hoy: string; abrir: () => void; cobrar: () => void }) {
  const t = totalesFactura(f.lineas, f.retencion);
  const estado = estadoFactura(f, hoy);
  const concepto = f.lineas
    .map((l) => l.concepto)
    .filter(Boolean)
    .join(' · ');
  return (
    <li className={`invoice-row is-${estado}`}>
      <button type="button" className="invoice-row-main" onClick={abrir}>
        <span className="invoice-row-icon" aria-hidden="true">
          <Icon name="facturas" size={18} />
        </span>
        <span className="invoice-row-text">
          <span className="invoice-row-title">
            <strong>{f.clienteNombre}</strong>
            <span className="faint">{f.numero}</span>
          </span>
          <span className="invoice-row-sub">
            {shortDate(f.fecha, hoy)}
            {concepto ? ` · ${concepto}` : ''}
          </span>
        </span>
        <span className="invoice-row-amount">
          <strong>{formatMoney(t.total)}</strong>
          <span className={`invoice-status is-${estado}`}>
            {estado === 'cobrada' && f.cobradaEn
              ? `Cobrada ${shortDate(f.cobradaEn, hoy)}`
              : estado === 'vencida'
                ? `Vencida ${shortDate(f.vencimiento, hoy)}`
                : `Vence ${shortDate(f.vencimiento, hoy)}`}
          </span>
        </span>
      </button>
      {estado !== 'cobrada' && (
        <button type="button" className="btn btn-secondary btn-sm invoice-row-collect" onClick={cobrar}>
          <Icon name="check" size={16} />
          Cobrada
        </button>
      )}
    </li>
  );
}

export function Facturas() {
  const facturas = useFacturas();
  const listaClientes = useClientes();
  const avisar = useToast();
  const ajustes = useAjustes();
  const perfil = perfilNegocio(ajustes?.negocio);
  const hoy = todayISO();
  const [trimestre, setTrimestre] = useState<Trimestre>(() => trimestreDe(hoy));
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState<{ factura?: Factura } | null>(null);
  const [cobro, setCobro] = useState<Factura | null>(null);
  const [clientes, setClientes] = useState(false);

  const delTrimestre = useMemo(() => facturas.filter((f) => enTrimestre(f.fecha, trimestre)), [facturas, trimestre]);
  const resumen = resumirFacturas(delTrimestre);
  const pendientes = facturas.filter((f) => !f.cobradaEn);
  const pendiente = resumirFacturas(pendientes);
  const vencidas = pendientes.filter((f) => estadoFactura(f, hoy) === 'vencida').length;
  // Con criterio de caja, el IVA del trimestre es el de lo cobrado en él.
  const ivaTrimestre =
    perfil.regimenIVA === 'caja'
      ? resumirFacturas(facturas.filter((f) => f.cobradaEn && enTrimestre(f.cobradaEn, trimestre))).iva
      : resumen.iva;

  const exportar = async () => {
    const nifs = new Map(listaClientes.map((c) => [c.id, c.nif]));
    const ok = await guardarArchivo(
      `neto-facturas-${trimestre.anio}-T${trimestre.t}.csv`,
      csvFacturas(delTrimestre, nifs),
      {
        descripcion: 'Hoja de cálculo (CSV)',
        extension: 'csv',
        tipoMime: 'text/csv;charset=utf-8',
      },
    );
    if (ok) avisar(`${contar(delTrimestre.length, 'factura exportada', 'facturas exportadas')}`);
  };

  const q = busqueda.trim().toLocaleLowerCase('es-ES');
  const buscando = q.length > 0;
  const lista = (buscando ? facturas : delTrimestre).filter((f) => {
    if (filtro === 'pendientes' && f.cobradaEn) return false;
    if (filtro === 'cobradas' && !f.cobradaEn) return false;
    if (!q) return true;
    return [f.numero, f.clienteNombre, f.nota, ...f.lineas.map((l) => l.concepto)].some((t) =>
      t.toLocaleLowerCase('es-ES').includes(q),
    );
  });

  return (
    <>
      <PageHeader
        titulo="Facturas"
        subtitulo="Registra las facturas que haces con tu programa de facturación y sigue cuáles has cobrado."
        acciones={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => void exportar()}
              disabled={delTrimestre.length === 0}
              title={delTrimestre.length === 0 ? 'No hay facturas en este trimestre' : undefined}
            >
              <Icon name="descargar" size={16} />
              Exportar
            </button>
            <button className="btn btn-secondary" onClick={() => setClientes(true)}>
              <Icon name="clientes" size={16} />
              Clientes
            </button>
            <button className="btn btn-primary" onClick={() => setForm({})}>
              <Icon name="mas" size={16} />
              Registrar factura
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
        <Segmented opciones={FILTROS} valor={filtro} onChange={setFiltro} etiqueta="Estado" />
        <input
          className="input input-search"
          placeholder="Buscar"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar en todas las facturas"
        />
      </div>

      {facturas.length > 0 && (
        <section className="recurring-summary invoice-summary" aria-label="Resumen de facturas">
          <div>
            <span className="summary-icon">
              <Icon name="facturas" size={20} />
            </span>
            <span>Facturado en el trimestre</span>
            <strong>{formatMoney(resumen.base)}</strong>
            <small>{contar(resumen.facturas, 'factura', 'facturas')} · sin IVA</small>
          </div>
          <div>
            <span className="summary-icon">
              <Icon name="impuestos" size={20} />
            </span>
            <span>IVA repercutido</span>
            <strong>{formatMoney(ivaTrimestre)}</strong>
            <small>
              {perfil.regimenIVA === 'caja' ? 'De lo cobrado en el trimestre' : 'De lo facturado en el trimestre'}
              {resumen.retencion > 0 ? ` · ${formatMoney(resumen.retencion)} retenidos` : ''}
            </small>
          </div>
          <div>
            <span className={`summary-icon${vencidas ? ' expense-text' : ''}`}>
              <Icon name={vencidas ? 'alerta' : 'calendario'} size={20} />
            </span>
            <span>Pendiente de cobro</span>
            <strong>{formatMoney(pendiente.total)}</strong>
            <small>
              {pendiente.facturas === 0
                ? 'Todo cobrado'
                : `${contar(pendiente.facturas, 'factura', 'facturas')}${vencidas ? ` · ${contar(vencidas, 'vencida', 'vencidas')}` : ''}`}
            </small>
          </div>
        </section>
      )}

      <div className="card invoice-list-card">
        {lista.length === 0 ? (
          <div className="empty">
            <div className="empty-title">
              {buscando
                ? 'Ninguna factura coincide con la búsqueda'
                : facturas.length === 0
                  ? 'Aún no has registrado facturas'
                  : filtro === 'todas'
                    ? 'No hay facturas en este trimestre'
                    : filtro === 'pendientes'
                      ? 'No hay facturas pendientes en este trimestre'
                      : 'No hay facturas cobradas en este trimestre'}
            </div>
            {facturas.length === 0 && (
              <>
                <div>Apunta cada factura que emitas: Neto suma su IVA y su retención para tus impuestos.</div>
                <button className="btn btn-primary" onClick={() => setForm({})}>
                  <Icon name="mas" size={16} />
                  Registrar la primera
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="invoice-list">
            {lista.map((f) => (
              <FilaFactura
                key={f.id}
                f={f}
                hoy={hoy}
                abrir={() => setForm({ factura: f })}
                cobrar={() => setCobro(f)}
              />
            ))}
          </ul>
        )}
      </div>

      {form && <FacturaForm factura={form.factura} onClose={() => setForm(null)} />}
      {cobro && <CobroForm factura={cobro} onClose={() => setCobro(null)} />}
      {clientes && <ClientesModal onClose={() => setClientes(false)} />}
    </>
  );
}
