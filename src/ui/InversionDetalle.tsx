import { useState } from 'react';
import { config } from '../config/neto.config';
import type { Inversion } from '../db/types';
import { valorInversion } from '../lib/investments';
import { shortDate, todayISO } from '../lib/dates';
import {
  datosDesde,
  formatPct,
  historialEnRango,
  precioMedioCompra,
  variacion,
  type PuntoMercado,
} from '../lib/mercado';
import { formatMoney, formatPrecio } from '../lib/money';
import type { Cotizacion } from '../lib/quotes';
import { fechaPrecio } from '../lib/quotes';
import { CategoryIcon } from './CategoryIcon';
import { Modal } from './Modal';
import { Segmented } from './Segmented';
import { ValueChart } from './ValueChart';

type Rango = (typeof config.inversiones.rangos)[number]['id'];
const RANGOS = config.inversiones.rangos.map((r) => ({ valor: r.id as Rango, texto: r.id }));

/**
 * Detalle de una inversión: cómo se ha movido su precio en el mercado (1S, 1M, 3M, 1A),
 * comparado con el precio al que la compraste, y cómo va tu posición.
 */
export function InversionDetalle({
  inversion,
  cotizacion,
  historialPropio,
  icono,
  color,
  onEditar,
  onClose,
}: {
  inversion: Inversion;
  cotizacion?: Cotizacion;
  /** Valor por unidad que Neto ha guardado cada día, para inversiones sin cotización. */
  historialPropio: PuntoMercado[];
  icono: string;
  color: string;
  onEditar: () => void;
  onClose: () => void;
}) {
  const [rango, setRango] = useState<Rango>('1M');
  const hoy = todayISO();
  const dias = config.inversiones.rangos.find((r) => r.id === rango)!.dias;
  const mercado = (cotizacion?.historial ?? []).length > 1;
  const fuente = mercado ? (cotizacion!.historial ?? []) : historialPropio;
  const puntos = historialEnRango(fuente, dias, hoy);
  const v = variacion(puntos);
  const desde = datosDesde(puntos, dias, hoy);
  const compra = precioMedioCompra(inversion);
  const valor = valorInversion(inversion);
  const ganancia = valor - inversion.coste;
  const textoRango = config.inversiones.rangos.find((r) => r.id === rango)!.texto;

  return (
    <Modal titulo={inversion.nombre} onClose={onClose}>
      <div className="modal-body inv-detail">
        <div className="inv-detail-head">
          <CategoryIcon icono={icono} color={color} size={46} />
          <div>
            <div className="muted">
              {cotizacion ? `${cotizacion.simbolo} · ${cotizacion.fuente}` : 'Valoración manual'}
            </div>
            <div className="inv-detail-price">{formatPrecio(inversion.precioEUR)}</div>
            <div className="field-hint">Precio de una unidad · {fechaPrecio(inversion.precioFecha)}</div>
          </div>
          {v && (
            <span className={`gain-chip ${v.cambio >= 0 ? 'is-up' : 'is-down'}`} title={textoRango}>
              {formatPct(v.pct)} {rango}
            </span>
          )}
        </div>

        <Segmented opciones={RANGOS} valor={rango} onChange={setRango} block etiqueta="Periodo" />

        <ValueChart
          key={rango}
          datos={puntos.map((p) => ({ fecha: p.fecha, valor: p.precioEUR }))}
          etiqueta={`Precio de ${inversion.nombre} ${textoRango}`}
          precio
          referencia={compra ? { valor: compra, etiqueta: 'Tu precio de compra' } : null}
        />
        <p className="field-hint">
          {v
            ? `${v.cambio >= 0 ? 'Ha subido' : 'Ha bajado'} un ${Math.abs(v.pct).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} % ${textoRango}: de ${formatPrecio(v.inicio)} a ${formatPrecio(v.fin)}.`
            : 'Aún no hay suficientes datos de este periodo.'}{' '}
          {desde && `Hay datos desde el ${shortDate(desde, hoy)}.`}{' '}
          {mercado
            ? 'Es el precio del mercado, no depende de cuándo compraste.'
            : 'Sin cotización en el catálogo: se muestra el valor que Neto ha ido guardando.'}
        </p>

        <div className="inv-detail-grid">
          <div>
            <span>Tienes</span>
            <b>{inversion.cantidad.toLocaleString('es-ES', { maximumFractionDigits: 12 })} unidades</b>
          </div>
          <div>
            <span>Precio medio de compra</span>
            <b>{compra ? formatPrecio(compra) : '—'}</b>
          </div>
          <div>
            <span>Pagaste</span>
            <b>{formatMoney(inversion.coste)}</b>
          </div>
          <div>
            <span>Vale ahora</span>
            <b>{formatMoney(valor)}</b>
          </div>
          <div>
            <span>{ganancia >= 0 ? 'Has ganado' : 'Has perdido'}</span>
            <b className={ganancia > 0 ? 'income-text' : ganancia < 0 ? 'expense-text' : undefined}>
              {formatMoney(Math.abs(ganancia))}
              {inversion.coste > 0 && (
                <span className={`gain-chip ${ganancia >= 0 ? 'is-up' : 'is-down'}`}>
                  {formatPct((ganancia / inversion.coste) * 100)}
                </span>
              )}
            </b>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onEditar}>
            Editar inversión
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
