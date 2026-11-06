import { useMemo, useState } from 'react';
import { config } from '../config/neto.config';
import { actualizarFactura, anularCobro, borrarFactura, crearFactura } from '../db/facturas';
import { useAjustes, useClientes, useFacturas } from '../db/hooks';
import type { Factura } from '../db/types';
import { longDate, todayISO } from '../lib/dates';
import {
  perfilNegocio,
  retencionSugerida,
  siguienteNumero,
  totalesFactura,
  vencimientoSugerido,
  type DatosFactura,
} from '../lib/facturas';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { AmountInput } from './AmountInput';
import { Icon } from './Icon';
import { Modal, useConfirm, useToast } from './Modal';
import { Segmented } from './Segmented';

interface LineaEditable {
  clave: number;
  concepto: string;
  base: string;
  tipoIVA: number;
}

const RETENCIONES = config.autonomo.irpf.tipos.map((t) => ({
  valor: String(t),
  texto: t === 0 ? 'Sin retención' : `${t} %`,
}));

let claves = 0;
const nuevaLinea = (l?: { concepto: string; base: number; tipoIVA: number }): LineaEditable => ({
  clave: ++claves,
  concepto: l?.concepto ?? '',
  base: l ? centsToInput(l.base) : '',
  tipoIVA: l?.tipoIVA ?? config.autonomo.iva.porDefecto,
});

export function FacturaForm({ factura, onClose }: { factura?: Factura; onClose: () => void }) {
  const ajustes = useAjustes();
  const facturas = useFacturas();
  const clientes = useClientes();
  const confirmar = useConfirm();
  const avisar = useToast();
  const perfil = perfilNegocio(ajustes?.negocio);
  const hoy = todayISO();

  const [fecha, setFecha] = useState(factura?.fecha ?? hoy);
  const [numero, setNumero] = useState(factura?.numero ?? '');
  const [numeroTocado, setNumeroTocado] = useState(Boolean(factura));
  const [vencimiento, setVencimiento] = useState(factura?.vencimiento ?? vencimientoSugerido(hoy));
  const [vencTocado, setVencTocado] = useState(Boolean(factura));
  const [cliente, setCliente] = useState(factura?.clienteNombre ?? '');
  // El NIF guardado del cliente llega cuando cargan los clientes; lo escrito a mano manda.
  const [nifEscrito, setNif] = useState<string | null>(null);
  const nifGuardado = (factura?.clienteId && clientes.find((c) => c.id === factura.clienteId)?.nif) || '';
  const nif = nifEscrito ?? nifGuardado;
  const [lineas, setLineas] = useState<LineaEditable[]>(() =>
    factura ? factura.lineas.map((l) => nuevaLinea(l)) : [nuevaLinea()],
  );
  const [retencion, setRetencion] = useState<number | null>(factura?.retencion ?? null);
  const [nota, setNota] = useState(factura?.nota ?? '');
  const [error, setError] = useState<string | null>(null);

  // Mientras la persona no lo cambie, el número sigue la serie del año de la factura.
  const numeroSugerido = useMemo(
    () =>
      siguienteNumero(
        facturas.filter((f) => f.id !== factura?.id).map((f) => f.numero),
        Number(fecha.slice(0, 4)),
      ),
    [facturas, factura?.id, fecha],
  );
  const numeroFinal = numeroTocado ? numero : numeroSugerido;
  const retencionFinal = retencion ?? retencionSugerida(perfil, fecha);

  const lineasValidas = lineas.map((l) => ({
    concepto: l.concepto,
    base: parseMoney(l.base) ?? 0,
    tipoIVA: l.tipoIVA,
  }));
  const totales = totalesFactura(
    lineasValidas.filter((l) => l.base > 0),
    retencionFinal,
  );
  const clienteConocido = clientes.find(
    (c) => c.nombre.toLocaleLowerCase('es-ES') === cliente.trim().toLocaleLowerCase('es-ES'),
  );

  const cambiarLinea = (clave: number, cambios: Partial<LineaEditable>) => {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
    setError(null);
  };

  const guardar = async () => {
    const malas = lineas.filter((l) => l.base !== '' && parseMoney(l.base) === null);
    if (malas.length) return setError('Escribe cada base como 1.234,56.');
    const datos: DatosFactura = {
      numero: numeroFinal,
      fecha,
      vencimiento,
      clienteNombre: cliente,
      clienteNif: nif,
      lineas: lineasValidas.filter((l, i) => l.base > 0 || lineas[i].concepto.trim()),
      retencion: retencionFinal,
      nota,
    };
    try {
      if (factura) await actualizarFactura(factura.id, datos);
      else await crearFactura(datos);
      avisar(factura ? 'Factura actualizada' : `Factura ${datos.numero.trim()} registrada`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la factura.');
    }
  };

  const eliminar = async () => {
    if (!factura) return;
    const ok = await confirmar({
      titulo: `Borrar la factura ${factura.numero}`,
      mensaje: factura.movimientoId
        ? 'También se borrará el ingreso que se apuntó al cobrarla, y el saldo de esa cuenta bajará.'
        : 'Dejará de contar para tus impuestos.',
      confirmar: 'Borrar factura',
      peligro: true,
    });
    if (!ok) return;
    await borrarFactura(factura.id);
    avisar('Factura borrada');
    onClose();
  };

  const deshacerCobro = async () => {
    if (!factura) return;
    const ok = await confirmar({
      titulo: 'Volver a pendiente',
      mensaje: factura.movimientoId
        ? 'Se borrará el ingreso que se apuntó al cobrarla.'
        : 'La factura volverá a contar como pendiente de cobro.',
      confirmar: 'Volver a pendiente',
    });
    if (!ok) return;
    await anularCobro(factura.id);
    avisar('Factura pendiente de cobro');
    onClose();
  };

  return (
    <Modal titulo={factura ? `Factura ${factura.numero}` : 'Registrar factura'} onClose={onClose} amplio>
      <form
        className="modal-body invoice-form"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {!factura && (
          <p className="field-hint invoice-form-intro">
            Copia los datos de la factura que has hecho con tu programa de facturación.
          </p>
        )}
        {factura?.cobradaEn && (
          <div className="invoice-paid-note">
            <Icon name="check" size={16} />
            <span>
              Cobrada el {longDate(factura.cobradaEn, true)}
              {factura.movimientoId ? ' · el ingreso está apuntado en tu cuenta' : ''}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void deshacerCobro()}>
              Volver a pendiente
            </button>
          </div>
        )}

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="ff-numero">
              Número
            </label>
            <input
              id="ff-numero"
              className="input"
              value={numeroFinal}
              onChange={(e) => {
                setNumero(e.target.value);
                setNumeroTocado(true);
                setError(null);
              }}
              maxLength={40}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ff-fecha">
              Fecha de la factura
            </label>
            <input
              id="ff-fecha"
              type="date"
              className="input"
              value={fecha}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setFecha(v);
                if (!vencTocado) setVencimiento(vencimientoSugerido(v));
                setError(null);
              }}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="ff-cliente">
              Cliente
            </label>
            <input
              id="ff-cliente"
              className="input"
              list="ff-clientes"
              value={cliente}
              data-autofocus={!factura || undefined}
              onChange={(e) => {
                setCliente(e.target.value);
                const c = clientes.find(
                  (x) => x.nombre.toLocaleLowerCase('es-ES') === e.target.value.trim().toLocaleLowerCase('es-ES'),
                );
                if (c) setNif(c.nif);
                setError(null);
              }}
              placeholder="Nombre o razón social"
              maxLength={120}
              autoComplete="off"
            />
            <datalist id="ff-clientes">
              {clientes.map((c) => (
                <option key={c.id} value={c.nombre} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ff-nif">
              NIF del cliente <span className="faint">(opcional)</span>
            </label>
            <input
              id="ff-nif"
              className="input"
              value={nif}
              onChange={(e) => setNif(e.target.value)}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
            />
            {clienteConocido && <span className="field-hint">Cliente guardado</span>}
          </div>
        </div>

        <fieldset className="invoice-lines">
          <legend className="field-label">Conceptos</legend>
          {lineas.map((l, i) => (
            <div className="invoice-line" key={l.clave}>
              <input
                className="input invoice-line-concept"
                value={l.concepto}
                onChange={(e) => cambiarLinea(l.clave, { concepto: e.target.value })}
                placeholder={i === 0 ? 'p. ej. Diseño de la web' : 'Otro concepto'}
                aria-label={`Concepto ${i + 1}`}
                maxLength={120}
              />
              <div className="invoice-line-base">
                <AmountInput
                  texto={l.base}
                  onChange={(t) => cambiarLinea(l.clave, { base: t })}
                  id={`ff-base-${l.clave}`}
                />
              </div>
              <select
                className="select invoice-line-iva"
                value={l.tipoIVA}
                onChange={(e) => cambiarLinea(l.clave, { tipoIVA: Number(e.target.value) })}
                aria-label={`IVA del concepto ${i + 1}`}
              >
                {config.autonomo.iva.tipos.map((t) => (
                  <option key={t} value={t}>
                    {t === 0 ? 'Sin IVA' : `IVA ${t} %`}
                  </option>
                ))}
              </select>
              {lineas.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
                  aria-label={`Quitar el concepto ${i + 1}`}
                >
                  <Icon name="cerrar" size={18} />
                </button>
              )}
            </div>
          ))}
          <span className="field-hint">Importes sin IVA (base imponible). «Sin IVA» para exentas o no sujetas.</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm invoice-add-line"
            onClick={() => setLineas((ls) => [...ls, nuevaLinea()])}
          >
            <Icon name="mas" size={16} />
            Añadir concepto
          </button>
        </fieldset>

        <div className="field">
          <span className="field-label">Retención de IRPF</span>
          <Segmented
            opciones={RETENCIONES}
            valor={String(retencionFinal)}
            onChange={(v) => setRetencion(Number(v))}
            block
            etiqueta="Retención de IRPF"
          />
          {retencion === null && (
            <span className="field-hint">
              {perfil.actividad === 'empresarial'
                ? 'Actividad empresarial: normalmente sin retención.'
                : perfil.nuevoAutonomo && retencionFinal === config.autonomo.irpf.retencionNuevoAutonomo
                  ? 'Retención reducida de nuevo autónomo.'
                  : 'La habitual para profesionales. Si facturas a un particular, no lleva retención.'}
            </span>
          )}
        </div>

        <dl className="invoice-totals" aria-live="polite">
          <div>
            <dt>Base imponible</dt>
            <dd>{formatMoney(totales.base)}</dd>
          </div>
          {totales.porTipo
            .filter((t) => t.tipo > 0)
            .map((t) => (
              <div key={t.tipo}>
                <dt>IVA {t.tipo} %</dt>
                <dd>{formatMoney(t.cuota)}</dd>
              </div>
            ))}
          {totales.retencion > 0 && (
            <div>
              <dt>Retención {retencionFinal} %</dt>
              <dd>{formatMoney(-totales.retencion)}</dd>
            </div>
          )}
          <div className="invoice-totals-total">
            <dt>Te pagan</dt>
            <dd>{formatMoney(totales.total)}</dd>
          </div>
        </dl>

        <details className="invoice-more" open={Boolean(factura?.nota) || vencTocado || undefined}>
          <summary>Vencimiento y nota</summary>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="ff-venc">
                Vence el
              </label>
              <input
                id="ff-venc"
                type="date"
                className="input"
                value={vencimiento}
                min={fecha}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setVencimiento(e.target.value);
                  setVencTocado(true);
                  setError(null);
                }}
              />
              {!vencTocado && (
                <span className="field-hint">
                  A {config.autonomo.diasVencimientoFactura} días de la fecha de la factura.
                </span>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="ff-nota">
                Nota <span className="faint">(opcional)</span>
              </label>
              <input
                id="ff-nota"
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
          {factura && (
            <button type="button" className="btn btn-ghost left" onClick={() => void eliminar()}>
              Borrar
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            {factura ? 'Guardar' : 'Registrar factura'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
