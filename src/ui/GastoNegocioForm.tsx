import { useMemo, useState } from 'react';
import { config } from '../config/neto.config';
import { actualizarGastoNegocio, borrarGastoNegocio, crearGastoNegocio } from '../db/gastosNegocio';
import { useAjustes, useCuentas, useGastosNegocio } from '../db/hooks';
import type { GastoNegocio } from '../db/types';
import { todayISO } from '../lib/dates';
import { aplicarPorcentaje, perfilNegocio } from '../lib/facturas';
import {
  CATEGORIAS_GASTO,
  amortizacionSugerida,
  aniosDeReparto,
  categoriaGasto,
  cifrasGasto,
  deduciblesSugeridos,
  desglosarTotal,
  limiteDietaDiaria,
  type DatosGastoNegocio,
} from '../lib/gastosNegocio';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { AmountInput } from './AmountInput';
import { Icon } from './Icon';
import { Modal, useConfirm, useToast } from './Modal';
import { Segmented } from './Segmented';

const MODOS = [
  { valor: 'total', texto: 'Total con IVA' },
  { valor: 'base', texto: 'Base sin IVA' },
] as const;

const leerPct = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(',', '.')));
const pctTexto = (n: number) => String(n).replace('.', ',');

/** Registra la factura o el ticket de un gasto del negocio y, si se elige cuenta, apunta su pago. */
export function GastoNegocioForm({ gasto, onClose }: { gasto?: GastoNegocio; onClose: () => void }) {
  const ajustes = useAjustes();
  const perfil = perfilNegocio(ajustes?.negocio);
  const gastos = useGastosNegocio();
  const todasCuentas = useCuentas();
  const confirmar = useConfirm();
  const avisar = useToast();
  const hoy = todayISO();

  const cuentas = todasCuentas.filter((c) => !c.eliminada && !c.archivada && !c.cuentaPadreId && !c.ahorroGeneral);
  const negocio = cuentas.filter((c) => c.ambito === 'negocio');
  const personales = cuentas.filter((c) => c.ambito !== 'negocio');

  const [fecha, setFecha] = useState(gasto?.fecha ?? hoy);
  const [proveedor, setProveedor] = useState(gasto?.proveedor ?? '');
  const [numero, setNumero] = useState(gasto?.numero ?? '');
  const [concepto, setConcepto] = useState(gasto?.concepto ?? '');
  const [categoria, setCategoria] = useState(gasto?.categoria ?? 'software');
  const [modo, setModo] = useState<'total' | 'base'>(gasto ? 'base' : 'total');
  const [importe, setImporte] = useState(gasto ? centsToInput(gasto.base) : '');
  const [tipoIVA, setTipoIVA] = useState<number>(gasto?.tipoIVA ?? categoriaGasto('software').tipoIVA);
  const [tipoTocado, setTipoTocado] = useState(Boolean(gasto));
  // Porcentajes: mientras la persona no los toque, siguen la categoría.
  const [pctIVA, setPctIVA] = useState<string | null>(gasto ? pctTexto(gasto.deducibleIVA) : null);
  const [pctIRPF, setPctIRPF] = useState<string | null>(gasto ? pctTexto(gasto.deducibleIRPF) : null);
  const [cuentaElegida, setCuenta] = useState<string | null>(gasto ? (gasto.cuentaId ?? '') : null);
  const [nota, setNota] = useState(gasto?.nota ?? '');
  const [error, setError] = useState<string | null>(null);

  const cuentaId = cuentaElegida ?? negocio[0]?.id ?? '';
  const sugeridos = deduciblesSugeridos(categoria, perfil);
  const deducibleIVA = pctIVA === null ? sugeridos.iva : leerPct(pctIVA);
  const deducibleIRPF = pctIRPF === null ? sugeridos.irpf : leerPct(pctIRPF);

  const cents = parseMoney(importe);
  const { base, cuotaIVA } =
    cents === null || cents <= 0
      ? { base: 0, cuotaIVA: 0 }
      : modo === 'total'
        ? desglosarTotal(cents, tipoIVA)
        : { base: cents, cuotaIVA: aplicarPorcentaje(cents, tipoIVA) };
  const cifras = cifrasGasto({
    base,
    cuotaIVA,
    deducibleIVA: Number.isFinite(deducibleIVA) ? deducibleIVA : 0,
    deducibleIRPF: Number.isFinite(deducibleIRPF) ? deducibleIRPF : 0,
  });
  // Equipo de más de 300 €: en el IRPF se reparte en varios años (el IVA se recupera entero).
  const amortizacion = amortizacionSugerida(categoria, base);
  const proveedores = useMemo(() => [...new Set(gastos.map((g) => g.proveedor))].sort(), [gastos]);
  const cat = categoriaGasto(categoria);
  const sinMetros = categoria === 'casa' && !(perfil.metrosVivienda && perfil.metrosTrabajo);

  const cambiarCategoria = (id: string) => {
    setCategoria(id);
    setPctIVA(null);
    setPctIRPF(null);
    if (!tipoTocado) setTipoIVA(categoriaGasto(id).tipoIVA);
    setError(null);
  };

  const guardar = async () => {
    if (cents === null || cents <= 0) return setError('Escribe el importe, como 48,40.');
    if (!Number.isFinite(deducibleIVA) || !Number.isFinite(deducibleIRPF))
      return setError('Escribe los porcentajes deducibles, de 0 a 100.');
    const datos: DatosGastoNegocio = {
      fecha,
      proveedor,
      numero,
      concepto,
      categoria,
      base,
      tipoIVA,
      cuotaIVA,
      deducibleIVA,
      deducibleIRPF,
      amortizacion,
      cuentaId: cuentaId || null,
      nota,
    };
    try {
      if (gasto) await actualizarGastoNegocio(gasto.id, datos);
      else await crearGastoNegocio(datos);
      avisar(gasto ? 'Gasto actualizado' : 'Gasto registrado');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el gasto.');
    }
  };

  const eliminar = async () => {
    if (!gasto) return;
    const ok = await confirmar({
      titulo: 'Borrar el gasto',
      mensaje: gasto.movimientoId
        ? 'También se borrará su pago de la cuenta, y el saldo volverá a subir.'
        : 'Dejará de contar para tus impuestos.',
      confirmar: 'Borrar gasto',
      peligro: true,
    });
    if (!ok) return;
    await borrarGastoNegocio(gasto.id);
    avisar('Gasto borrado');
    onClose();
  };

  return (
    <Modal titulo={gasto ? 'Gasto del negocio' : 'Registrar gasto'} onClose={onClose} amplio>
      <form
        className="modal-body invoice-form"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="gn-proveedor">
              ¿Quién te lo cobra?
            </label>
            <input
              id="gn-proveedor"
              className="input"
              list="gn-proveedores"
              value={proveedor}
              onChange={(e) => {
                setProveedor(e.target.value);
                setError(null);
              }}
              placeholder="p. ej. Adobe, Movistar, gasolinera"
              maxLength={120}
              autoComplete="off"
              data-autofocus={!gasto || undefined}
            />
            <datalist id="gn-proveedores">
              {proveedores.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="gn-fecha">
              Fecha
            </label>
            <input
              id="gn-fecha"
              type="date"
              className="input"
              value={fecha}
              onChange={(e) => {
                if (e.target.value) setFecha(e.target.value);
                setError(null);
              }}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="gn-categoria">
              Categoría
            </label>
            <select
              id="gn-categoria"
              className="select"
              value={categoria}
              onChange={(e) => cambiarCategoria(e.target.value)}
            >
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="gn-concepto">
              Concepto <span className="faint">(opcional)</span>
            </label>
            <input
              id="gn-concepto"
              className="input"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="p. ej. Creative Cloud de octubre"
              maxLength={120}
            />
          </div>
        </div>

        <div className="field">
          <span className="field-label">Importe</span>
          <Segmented opciones={MODOS} valor={modo} onChange={setModo} block etiqueta="Cómo escribes el importe" />
          <div className="expense-amount">
            <AmountInput
              id="gn-importe"
              texto={importe}
              onChange={(t) => {
                setImporte(t);
                setError(null);
              }}
            />
            <select
              className="select"
              value={tipoIVA}
              onChange={(e) => {
                setTipoIVA(Number(e.target.value));
                setTipoTocado(true);
              }}
              aria-label="Tipo de IVA"
            >
              {config.autonomo.iva.tipos.map((t) => (
                <option key={t} value={t}>
                  {t === 0 ? 'Sin IVA' : `IVA ${t} %`}
                </option>
              ))}
            </select>
          </div>
          <span className="field-hint">
            {modo === 'total'
              ? 'Lo que pagaste, como aparece en el ticket. Neto separa la base y el IVA.'
              : 'La base imponible de la factura, antes de sumar el IVA.'}
          </span>
        </div>

        <div className="field">
          <span className="field-label">Qué puedes deducir</span>
          <div className="field-row">
            <div className="field">
              <label className="field-hint" htmlFor="gn-pct-iva">
                Del IVA
              </label>
              <div className="input-suffix">
                <input
                  id="gn-pct-iva"
                  className="input num"
                  inputMode="decimal"
                  value={pctIVA ?? pctTexto(sugeridos.iva)}
                  onChange={(e) => /^\d{0,3}([.,]\d{0,2})?$/.test(e.target.value) && setPctIVA(e.target.value)}
                />
                <span aria-hidden="true">%</span>
              </div>
            </div>
            <div className="field">
              <label className="field-hint" htmlFor="gn-pct-irpf">
                Como gasto en el IRPF
              </label>
              <div className="input-suffix">
                <input
                  id="gn-pct-irpf"
                  className="input num"
                  inputMode="decimal"
                  value={pctIRPF ?? pctTexto(sugeridos.irpf)}
                  onChange={(e) => /^\d{0,3}([.,]\d{0,2})?$/.test(e.target.value) && setPctIRPF(e.target.value)}
                />
                <span aria-hidden="true">%</span>
              </div>
            </div>
          </div>
          <span className="field-hint">
            {sinMetros ? (
              <>
                Para la luz, el agua y el internet de casa, indica los metros en{' '}
                <a className="text-link" href="#/ajustes">
                  Ajustes › Tu negocio
                </a>{' '}
                y Neto calcula el 30 % de la parte donde trabajas.
              </>
            ) : categoria === 'casa' ? (
              'El 30 % de la parte de tu casa donde trabajas.'
            ) : categoria === 'vehiculo' ? (
              'Lo habitual: la mitad del IVA y nada en el IRPF, salvo que el coche sea solo para trabajar.'
            ) : categoria === 'telefono' ? (
              'Si el móvil es también personal, se deduce la parte de uso profesional (la mitad, por defecto).'
            ) : categoria === 'dietas' ? (
              `Solo comidas de trabajo pagadas con tarjeta, hasta ${formatMoney(limiteDietaDiaria)} al día en España sin pernoctar.`
            ) : cat.iva === 0 ? (
              'Estas facturas no llevan IVA; cuentan entero como gasto en el IRPF.'
            ) : (
              'Un gasto solo del negocio se deduce entero.'
            )}
            {(pctIVA !== null || pctIRPF !== null) && (
              <>
                {' '}
                <button
                  type="button"
                  className="text-link link-button"
                  onClick={() => {
                    setPctIVA(null);
                    setPctIRPF(null);
                  }}
                >
                  Usar lo propuesto
                </button>
              </>
            )}
          </span>
          {amortizacion !== null && cifras.gastoIRPF > 0 && (
            <span className="expense-spread">
              <Icon name="calendario" size={16} />
              <span>
                Como pasa de {formatMoney(config.autonomo.amortizacion.umbral)}, Hacienda no deja contarlo todo este
                año: se reparte en unos {aniosDeReparto(amortizacion)} años, un {amortizacion} % cada año. Neto lo hace
                solo. El IVA sí lo recuperas entero ahora.
              </span>
            </span>
          )}
          {categoria === 'dietas' && cifras.total > limiteDietaDiaria && (
            <span className="field-hint expense-warning">
              Supera el límite diario de {formatMoney(limiteDietaDiaria)}: comprueba con tu gestor qué parte puedes
              deducir.
            </span>
          )}
        </div>

        <dl className="invoice-totals" aria-live="polite">
          <div>
            <dt>Base</dt>
            <dd>{formatMoney(base)}</dd>
          </div>
          {tipoIVA > 0 && (
            <div>
              <dt>IVA {tipoIVA} %</dt>
              <dd>{formatMoney(cuotaIVA)}</dd>
            </div>
          )}
          <div>
            <dt>IVA que recuperas</dt>
            <dd>{formatMoney(cifras.ivaDeducible)}</dd>
          </div>
          <div>
            <dt>
              Cuenta como gasto en el IRPF
              {amortizacion !== null && cifras.gastoIRPF > 0 && (
                <small> · {formatMoney(Math.round((cifras.gastoIRPF * amortizacion) / 100))} al año</small>
              )}
            </dt>
            <dd>{formatMoney(cifras.gastoIRPF)}</dd>
          </div>
          <div className="invoice-totals-total">
            <dt>Pagaste</dt>
            <dd>{formatMoney(cifras.total)}</dd>
          </div>
        </dl>

        <div className="field">
          <label className="field-label" htmlFor="gn-cuenta">
            ¿Desde dónde lo pagaste?
          </label>
          <select id="gn-cuenta" className="select" value={cuentaId} onChange={(e) => setCuenta(e.target.value)}>
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
              ? 'Neto apunta el pago en esa cuenta, así su saldo cuadra con el banco.'
              : 'Solo se registra el gasto para tus impuestos.'}
          </span>
        </div>

        <details className="invoice-more" open={Boolean(gasto?.numero || gasto?.nota) || undefined}>
          <summary>Número de factura y nota</summary>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="gn-numero">
                Número de la factura
              </label>
              <input
                id="gn-numero"
                className="input"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="gn-nota">
                Nota
              </label>
              <input
                id="gn-nota"
                className="input"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
        </details>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          {gasto && (
            <button type="button" className="btn btn-ghost left" onClick={() => void eliminar()}>
              Borrar
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {gasto ? 'Guardar' : 'Registrar gasto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
