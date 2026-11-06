import { useState } from 'react';
import { cobrarFactura } from '../db/facturas';
import { useCuentas } from '../db/hooks';
import type { Factura } from '../db/types';
import { todayISO } from '../lib/dates';
import { totalesFactura } from '../lib/facturas';
import { formatMoney } from '../lib/money';
import { Modal, useToast } from './Modal';

/** Marca una factura como cobrada y, si se elige cuenta, apunta el ingreso en ella. */
export function CobroForm({ factura, onClose }: { factura: Factura; onClose: () => void }) {
  const cuentas = useCuentas().filter((c) => !c.eliminada && !c.cuentaPadreId);
  const avisar = useToast();
  const hoy = todayISO();
  const negocio = cuentas.filter((c) => c.ambito === 'negocio');
  const personales = cuentas.filter((c) => c.ambito !== 'negocio');
  const [fecha, setFecha] = useState(factura.fecha > hoy ? factura.fecha : hoy);
  // Hasta que la persona elija, se propone la primera cuenta del negocio (las cuentas cargan después).
  const [elegida, setElegida] = useState<string | null>(null);
  const cuentaId = elegida ?? negocio[0]?.id ?? personales[0]?.id ?? '';
  const [error, setError] = useState<string | null>(null);
  const total = totalesFactura(factura.lineas, factura.retencion).total;

  const guardar = async () => {
    try {
      await cobrarFactura(factura.id, { fecha, cuentaId: cuentaId || null });
      avisar(`Factura ${factura.numero} cobrada`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar como cobrada.');
    }
  };

  return (
    <Modal titulo={`Cobrar la factura ${factura.numero}`} onClose={onClose} pequeno>
      <form
        className="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="collect-amount">
          <span>{factura.clienteNombre} te paga</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cb-fecha">
            Fecha del cobro
          </label>
          <input
            id="cb-fecha"
            type="date"
            className="input"
            value={fecha}
            min={factura.fecha}
            max={hoy}
            onChange={(e) => {
              if (e.target.value) setFecha(e.target.value);
              setError(null);
            }}
            data-autofocus
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cb-cuenta">
            ¿Dónde lo has cobrado?
          </label>
          <select id="cb-cuenta" className="select" value={cuentaId} onChange={(e) => setElegida(e.target.value)}>
            {negocio.length > 0 && (
              <optgroup label="Negocio">
                {negocio.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </optgroup>
            )}
            {personales.length > 0 && (
              <optgroup label="Personal">
                {personales.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </optgroup>
            )}
            <option value="">No apuntarlo en ninguna cuenta</option>
          </select>
          <span className="field-hint">
            {cuentaId
              ? 'Neto apunta el ingreso en esa cuenta, así su saldo cuadra con el banco.'
              : 'Solo se marca como cobrada. Útil si ya apuntaste el ingreso a mano.'}
          </span>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Marcar como cobrada
          </button>
        </div>
      </form>
    </Modal>
  );
}
