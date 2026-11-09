import { useEffect, useState } from 'react';
import { config } from '../config/neto.config';
import { guardarPerfilNegocio } from '../db/repo';
import type { PerfilNegocio } from '../db/types';
import { perfilNegocio, retencionSugerida } from '../lib/facturas';
import { afectacionVivienda } from '../lib/gastosNegocio';
import { todayISO } from '../lib/dates';
import { AmountInput, useAmountField } from './AmountInput';
import { useToast } from './Modal';
import { Segmented } from './Segmented';
import { Switch } from './Switch';

const ACTIVIDADES = [
  { valor: 'profesional', texto: 'Profesional' },
  { valor: 'empresarial', texto: 'Empresarial' },
] as const;
const IVA = [
  { valor: 'devengo', texto: 'Al emitir la factura' },
  { valor: 'caja', texto: 'Al cobrarla' },
] as const;
const IRPF = [
  { valor: 'simplificada', texto: 'Directa simplificada' },
  { valor: 'normal', texto: 'Directa normal' },
] as const;

/** Datos fiscales que usan Facturas, Gastos e Impuestos. Cada cambio se guarda al momento. */
export function PerfilNegocioCard({ perfil: guardado }: { perfil?: PerfilNegocio }) {
  const avisar = useToast();
  const perfil = perfilNegocio(guardado);
  const cuota = useAmountField(perfil.cuotaMensual || undefined);
  const [reserva, setReserva] = useState(String(perfil.reservaIRPF));
  useEffect(() => setReserva(String(perfil.reservaIRPF)), [perfil.reservaIRPF]);
  const [metros, setMetros] = useState({
    vivienda: perfil.metrosVivienda ? String(perfil.metrosVivienda) : '',
    trabajo: perfil.metrosTrabajo ? String(perfil.metrosTrabajo) : '',
  });
  // Sin sincronizar desde la base: al guardar un campo no se borra lo que se escribe en el otro.
  const guardarMetros = () => {
    const leer = (t: string) => (t.trim() ? Number(t.replace(',', '.')) : null);
    const v = leer(metros.vivienda);
    const t = leer(metros.trabajo);
    if (v === (perfil.metrosVivienda ?? null) && t === (perfil.metrosTrabajo ?? null)) return;
    void guardar({ metrosVivienda: v, metrosTrabajo: t });
  };
  const afectacion = afectacionVivienda(perfil);

  const guardar = async (cambios: Partial<PerfilNegocio>) => {
    try {
      await guardarPerfilNegocio(cambios);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  };

  const retencion = retencionSugerida(perfil, todayISO());

  return (
    <section className="card business-profile" aria-labelledby="tu-negocio">
      <div className="card-header">
        <h2 className="card-title" id="tu-negocio">
          Tu negocio
        </h2>
      </div>
      <p className="muted">
        Con estos datos Neto propone la retención de tus facturas y calcula tus impuestos. Neto no emite facturas:
        registra las que haces con tu programa de facturación.
      </p>

      <div className="field">
        <span className="field-label">Tipo de actividad</span>
        <Segmented
          opciones={ACTIVIDADES}
          valor={perfil.actividad}
          onChange={(actividad) => void guardar({ actividad })}
          block
          etiqueta="Tipo de actividad"
        />
        <span className="field-hint">
          {perfil.actividad === 'profesional'
            ? 'Diseño, consultoría, programación… Tus facturas a empresas y autónomos llevan retención de IRPF.'
            : 'Comercio, hostelería, oficios… Tus facturas normalmente no llevan retención.'}
        </span>
      </div>

      <div className="setting-row">
        <div className="setting-text">
          <div className="setting-title">Nuevo autónomo</div>
          <div className="setting-desc">
            Retención del {config.autonomo.irpf.retencionNuevoAutonomo} % el año de alta y los{' '}
            {config.autonomo.irpf.aniosRetencionReducida} siguientes.
          </div>
        </div>
        <Switch
          activo={perfil.nuevoAutonomo}
          onChange={(nuevoAutonomo) => void guardar({ nuevoAutonomo })}
          etiqueta="Nuevo autónomo"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="pn-alta">
            Fecha de alta en Hacienda
          </label>
          <input
            id="pn-alta"
            type="date"
            className="input"
            value={perfil.fechaAlta ?? ''}
            max={todayISO()}
            onChange={(e) => void guardar({ fechaAlta: e.target.value || null })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pn-cuota">
            Cuota de autónomos al mes
          </label>
          <AmountInput id="pn-cuota" texto={cuota.texto} onChange={cuota.setTexto} />
          <span className="field-hint">Lo que te cobra la Seguridad Social. Cuenta como gasto del negocio.</span>
        </div>
      </div>
      {cuota.texto !== '' && cuota.cents === null && (
        <div className="form-error" role="alert">
          Escribe la cuota como 1.234,56.
        </div>
      )}
      {cuota.cents !== null && cuota.cents !== perfil.cuotaMensual && (
        <div className="business-profile-save">
          <button className="btn btn-secondary btn-sm" onClick={() => void guardar({ cuotaMensual: cuota.cents ?? 0 })}>
            Guardar cuota
          </button>
        </div>
      )}

      <div className="field">
        <span className="field-label">¿Cuándo declaras el IVA?</span>
        <Segmented
          opciones={IVA}
          valor={perfil.regimenIVA}
          onChange={(regimenIVA) => void guardar({ regimenIVA })}
          block
          etiqueta="Cuándo declaras el IVA"
        />
        <span className="field-hint">
          {perfil.regimenIVA === 'devengo'
            ? 'Lo habitual: el IVA cuenta en el trimestre en que haces la factura, la hayas cobrado o no.'
            : 'Criterio de caja: solo si lo pediste a Hacienda. El IVA cuenta cuando cobras la factura.'}
        </span>
      </div>

      <div className="field">
        <span className="field-label">Régimen de IRPF</span>
        <Segmented
          opciones={IRPF}
          valor={perfil.regimenIRPF}
          onChange={(regimenIRPF) => void guardar({ regimenIRPF })}
          block
          etiqueta="Régimen de IRPF"
        />
        <span className="field-hint">
          {perfil.regimenIRPF === 'simplificada'
            ? 'El más común. Permite deducir un 5 % de gastos de difícil justificación, con un máximo de 2.000 € al año.'
            : 'Obligatorio si facturas más de 600.000 € al año o si lo elegiste.'}
        </span>
      </div>

      <div className="field">
        <span className="field-label">Trabajo desde casa</span>
        <div className="field-row">
          <div className="field">
            <label className="field-hint" htmlFor="pn-m-vivienda">
              Metros de la vivienda
            </label>
            <div className="input-suffix">
              <input
                id="pn-m-vivienda"
                className="input num"
                inputMode="decimal"
                value={metros.vivienda}
                onChange={(e) =>
                  /^\d{0,5}([.,]\d?)?$/.test(e.target.value) && setMetros({ ...metros, vivienda: e.target.value })
                }
                onBlur={guardarMetros}
              />
              <span aria-hidden="true">m²</span>
            </div>
          </div>
          <div className="field">
            <label className="field-hint" htmlFor="pn-m-trabajo">
              Metros donde trabajas
            </label>
            <div className="input-suffix">
              <input
                id="pn-m-trabajo"
                className="input num"
                inputMode="decimal"
                value={metros.trabajo}
                onChange={(e) =>
                  /^\d{0,5}([.,]\d?)?$/.test(e.target.value) && setMetros({ ...metros, trabajo: e.target.value })
                }
                onBlur={guardarMetros}
              />
              <span aria-hidden="true">m²</span>
            </div>
          </div>
        </div>
        <span className="field-hint">
          {afectacion > 0
            ? `Trabajas en el ${afectacion.toLocaleString('es-ES')} % de tu casa: de la luz, el agua y el internet puedes deducir el 30 % de esa parte, un ${(Math.round(30 * afectacion) / 100).toLocaleString('es-ES')} %.`
            : 'Si trabajas en casa, de la luz, el agua y el internet puedes deducir el 30 % de la parte que usas para trabajar. Déjalo vacío si no trabajas en casa.'}
        </span>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="pn-reserva">
          Reserva para el IRPF
        </label>
        <div className="input-suffix">
          <input
            id="pn-reserva"
            className="input num"
            inputMode="decimal"
            value={reserva}
            onChange={(e) => /^\d{0,2}([.,]\d?)?$/.test(e.target.value) && setReserva(e.target.value)}
            onBlur={() => {
              const v = Number(reserva.replace(',', '.'));
              if (Number.isFinite(v) && v !== perfil.reservaIRPF) void guardar({ reservaIRPF: v });
              else setReserva(String(perfil.reservaIRPF));
            }}
          />
          <span aria-hidden="true">%</span>
        </div>
        <span className="field-hint">
          Parte de tu beneficio que Neto aparta para Hacienda. El pago trimestral es del{' '}
          {config.autonomo.irpf.pagoFraccionado} %, pero en la declaración anual suele salir algo más.
        </span>
      </div>

      <p className="business-profile-summary">
        Retención que Neto propondrá en tus facturas de hoy: <strong>{retencion} %</strong>
      </p>
    </section>
  );
}
