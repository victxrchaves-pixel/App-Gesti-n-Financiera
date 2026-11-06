import {ImportCSV} from '../ui/ImportCSV';
import { useMemo, useState } from 'react';
import { useAjustes, useCategorias, useCuentas, useMapaCategorias, useMovimientos } from '../db/hooks';
import type { Movimiento, TipoMovimiento } from '../db/types';
import { addMonths, dayHeader, monthKey, monthLabel, todayISO } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { clasificar, ordenarMovimientos } from '../lib/stats';
import { PageHeader } from '../layout/Shell';
import { Icon } from '../ui/Icon';
import { MovimientoForm } from '../ui/MovimientoForm';
import { MovimientoRow } from '../ui/MovimientoRow';
import { Segmented } from '../ui/Segmented';

type FiltroTipo = 'todos' | TipoMovimiento;
const TIPOS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'gasto', texto: 'Gastos' },
  { valor: 'ingreso', texto: 'Ingresos' },
  { valor: 'transferencia', texto: 'Transferencias' },
] as const;

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function Movimientos() {
  const ajustes = useAjustes();
  const cuentas = useCuentas();
  const categoriasLista = useCategorias();
  const categorias = useMapaCategorias();
  const movimientos = useMovimientos();
  const hoy = todayISO();
  const [importar,setImportar]=useState(false);

  const [mes, setMes] = useState(monthKey(hoy));
  const [tipo, setTipo] = useState<FiltroTipo>('todos');
  const [cuentaId, setCuentaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState<{ movimiento?: Movimiento } | null>(null);

  const mapaCuentas = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas]);
  const ambitoDe = (id: string | undefined) => (id ? mapaCuentas.get(id)?.ambito : undefined);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return ordenarMovimientos(
      movimientos.filter((m) => {
        if (q) {
          const texto = normalizar(`${m.reparto?.map(p=>categorias.get(p.categoriaId)?.nombre).join(' ')??''} ${m.nota} ${m.categoriaId ? categorias.get(m.categoriaId)?.nombre ?? '' : ''}`);
          if (!texto.includes(q)) return false;
        } else if (monthKey(m.fecha) !== mes) return false;
        if (tipo !== 'todos' && m.tipo !== tipo) return false;
        if(cuentaId&&![m.cuentaId,m.cuentaDestinoId].some(id=>id===cuentaId||(id&&mapaCuentas.get(id)?.cuentaPadreId===cuentaId)))return false;
        if (categoriaId && m.categoriaId !== categoriaId && !m.reparto?.some(p=>p.categoriaId===categoriaId)) return false;
        return true;
      }),
    );
  }, [movimientos, busqueda, mes, tipo, cuentaId, categoriaId, categorias, mapaCuentas]);

  const totales = useMemo(() => {
    let ingresos = 0;
    let gastos = 0;
    for (const m of filtrados.filter(m=>m.fecha<=hoy)) {
      const ambito = ambitoDe(m.cuentaId) ?? 'personal';
      const c = clasificar(m, ambitoDe, ambito);
      ingresos += c.ingreso;
      gastos += c.gasto;
    }
    return { ingresos, gastos };
  }, [filtrados, mapaCuentas]);

  const grupos = useMemo(() => {
    const g = new Map<string, Movimiento[]>();
    for (const m of filtrados) g.set(m.fecha, [...(g.get(m.fecha) ?? []), m]);
    return [...g.entries()];
  }, [filtrados]);

  const buscando = busqueda.trim() !== '';

  return (
    <>
      <PageHeader
        titulo="Movimientos"
        acciones={<><button className="btn btn-secondary" onClick={()=>setImportar(true)}><Icon name="subir" size={16}/>Importar CSV</button><button className="btn btn-primary" onClick={() => setForm({})}><Icon name="mas" size={16} stroke={2.2} />Nuevo movimiento</button></>}
      />

      {movimientos.some(m=>m.fecha>hoy)&&<div className="finance-notice">Hay registros antiguos con fecha futura. No cuentan en saldos ni resúmenes; abre cada uno para corregir su fecha.</div>}
      <div className="toolbar">
        {!buscando && (
          <div className="month-nav">
            <button className="btn btn-ghost btn-icon" onClick={() => setMes(addMonths(mes, -1))} aria-label="Mes anterior"><Icon name="izquierda" size={18} /></button>
            <span className="label">{monthLabel(mes).replace(/^./, (c) => c.toUpperCase())}</span>
            <button className="btn btn-ghost btn-icon" onClick={() => setMes(addMonths(mes, 1))} aria-label="Mes siguiente"><Icon name="derecha" size={18} /></button>
          </div>
        )}
        <Segmented opciones={TIPOS} valor={tipo} onChange={setTipo} etiqueta="Tipo" />
        <select className="select" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} aria-label="Cuenta">
          <option value="">Todas las cuentas</option>
          {cuentas.filter(c=>!c.eliminada&&!c.cuentaPadreId).map((c) => <option key={c.id} value={c.id}>{c.nombre}{ajustes?.autonomo && c.ambito === 'negocio' ? ' (negocio)' : ''}</option>)}
        </select>
        <select className="select" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categoriasLista.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input className="input input-search" placeholder="Buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar en todos los meses" />
      </div>

      <div className="card">
        <div className="summary-strip">
          <div><div className="kpi-label">Ingresos</div><div className="kpi-value positive">{formatMoney(totales.ingresos)}</div></div>
          <div><div className="kpi-label">Gastos</div><div className="kpi-value expense-text">{formatMoney(totales.gastos)}</div></div>
          <div><div className="kpi-label">Balance</div><div className="kpi-value">{formatMoney(totales.ingresos - totales.gastos)}</div></div>
          {buscando && <div className="muted" style={{ alignSelf: 'flex-end', fontSize: 13 }}>Buscando en todos los meses · {filtrados.length} resultado{filtrados.length === 1 ? '' : 's'}</div>}
        </div>

        {grupos.length === 0 ? (
          <div className="empty">
            <div className="empty-title">{buscando ? 'Nada coincide con la búsqueda' : 'No hay movimientos'}</div>
            {!buscando && <div>Apunta un gasto o un ingreso para empezar.</div>}
          </div>
        ) : (
          grupos.map(([fecha, lista]) => (
            <div key={fecha} className="day-group">
              <div className="day-header"><span>{dayHeader(fecha, hoy)}</span></div>
              <div className="list">
                {lista.map((m) => (
                  <MovimientoRow key={m.id} m={m} categorias={categorias} cuentas={mapaCuentas} onClick={() => setForm({ movimiento: m })} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {importar&&<ImportCSV cerrar={()=>setImportar(false)}/>}
      {form && <MovimientoForm movimiento={form.movimiento} onClose={() => setForm(null)} />}
    </>
  );
}
