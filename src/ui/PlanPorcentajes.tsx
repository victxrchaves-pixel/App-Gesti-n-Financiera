import { useEffect, useMemo, useState } from 'react';
import { colorCategoria, config } from '../config/neto.config';
import { aplicarPlanPorcentajes } from '../db/budgets';
import { useCategorias, useCuentas, useMovimientos, usePresupuestos } from '../db/hooks';
import { monthLabel, todayISO } from '../lib/dates';
import { iconoCategoria } from '../lib/iconos';
import { formatMoney } from '../lib/money';
import {
  ingresoSugerido,
  limitesPlan,
  plantillaPorId,
  porcentajesIniciales,
  porcentajeValido,
  resumenPlan,
} from '../lib/planPorcentajes';
import { AmountInput, useAmountField } from './AmountInput';
import { CategoryIcon } from './CategoryIcon';
import { Modal, useConfirm, useToast } from './Modal';
import { Segmented } from './Segmented';

const PLANTILLAS = config.presupuestos.plantillas.map((p) => ({ valor: p.id, texto: p.nombre }));

/**
 * Crea el presupuesto del mes repartiendo tu ingreso mensual por porcentajes.
 * Se puede usar desde Presupuestos, desde Inicio o al terminar la bienvenida.
 */
export function PlanPorcentajes({ mes, onClose }: { mes: string; onClose: () => void }) {
  const categorias = useCategorias();
  const cuentas = useCuentas();
  const movimientos = useMovimientos();
  const actuales = usePresupuestos(mes);
  const confirmar = useConfirm();
  const avisar = useToast();
  const sugerido = useMemo(() => ingresoSugerido(movimientos, cuentas, todayISO()), [movimientos, cuentas]);
  const ingreso = useAmountField(sugerido > 0 ? sugerido : undefined);
  const [tocadoIngreso, setTocadoIngreso] = useState(false);
  const [plantilla, setPlantilla] = useState<string>(config.presupuestos.plantillas[0].id);
  const [textos, setTextos] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Cuando llegan los datos, el ingreso sugerido rellena el campo (si no se ha escrito nada).
  useEffect(() => {
    if (!tocadoIngreso && sugerido > 0 && ingreso.texto === '')
      ingreso.setTexto(formatMoney(sugerido, { simbolo: false }));
  }, [sugerido, tocadoIngreso, ingreso]);

  const gasto = categorias.filter((c) => c.tipo === 'gasto').sort((a, b) => a.orden - b.orden);
  const base = useMemo(() => porcentajesIniciales(plantillaPorId(plantilla), categorias), [plantilla, categorias]);
  const porcentajes = new Map(
    gasto.map((c) => {
      const t = textos.get(c.id);
      return [c.id, t === undefined ? (base.get(c.id) ?? 0) : (porcentajeValido(t) ?? 0)];
    }),
  );
  const cents = ingreso.cents ?? 0;
  const resumen = resumenPlan(cents, porcentajes);
  const invalido = [...textos.values()].some((t) => porcentajeValido(t) === null);

  const cambiarPlantilla = (id: string) => {
    setPlantilla(id);
    setTextos(new Map());
    setError(null);
  };

  const crear = async () => {
    if (!ingreso.cents || ingreso.cents <= 0) return setError('Escribe cuánto ingresas al mes.');
    if (invalido) return setError('Revisa los porcentajes: entre 0 y 100, con un decimal como mucho.');
    if (resumen.error) return setError(resumen.error);
    const limites = limitesPlan(ingreso.cents, porcentajes);
    if (!limites.length) return setError('Pon un porcentaje al menos a una categoría.');
    if (actuales.length) {
      const ok = await confirmar({
        titulo: `Sustituir el presupuesto de ${monthLabel(mes, false)}`,
        mensaje: `Ya tienes ${actuales.length} límite${actuales.length === 1 ? '' : 's'} este mes. Se sustituirán por los de este reparto. Tus movimientos no cambian.`,
        confirmar: 'Sustituir',
      });
      if (!ok) return;
    }
    setGuardando(true);
    try {
      await aplicarPlanPorcentajes(mes, limites);
      avisar('Presupuesto creado');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el presupuesto.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal titulo="Presupuesto según tus ingresos" onClose={onClose}>
      <form
        className="modal-body plan-pct"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <p className="muted plan-pct-intro">
          Dinos cuánto ingresas al mes y elige un reparto. Neto calcula un límite para cada categoría; luego puedes
          ajustarlos cuando quieras.
        </p>

        <div className="field">
          <label className="field-label" htmlFor="pp-ingreso">
            ¿Cuánto ingresas al mes?
          </label>
          <AmountInput
            id="pp-ingreso"
            texto={ingreso.texto}
            onChange={(t) => {
              setTocadoIngreso(true);
              ingreso.setTexto(t);
              setError(null);
            }}
            grande
            autoFocus
          />
          <span className="field-hint">
            {sugerido > 0
              ? `Sugerido a partir de tus ingresos recientes: ${formatMoney(sugerido)}. Cámbialo si no es tu ingreso habitual.`
              : 'Tu nómina u otros ingresos habituales, ya sin impuestos.'}
          </span>
        </div>

        <div className="field">
          <span className="field-label">Reparto</span>
          <Segmented opciones={PLANTILLAS} valor={plantilla} onChange={cambiarPlantilla} block etiqueta="Reparto" />
          <span className="field-hint">
            {plantillaPorId(plantilla).resumen} · {plantillaPorId(plantilla).descripcion}
          </span>
        </div>

        <div className="plan-pct-list" role="group" aria-label="Porcentaje de cada categoría">
          {gasto.map((c) => {
            const pct = porcentajes.get(c.id) ?? 0;
            const texto = textos.get(c.id) ?? String(base.get(c.id) ?? 0).replace('.', ',');
            return (
              <div className="plan-pct-row" key={c.id}>
                <CategoryIcon icono={iconoCategoria(c)} color={colorCategoria(c.color)} size={34} />
                <span className="plan-pct-name">{c.nombre}</span>
                <span className="plan-pct-input">
                  <input
                    className="input num"
                    inputMode="decimal"
                    value={texto}
                    aria-label={`Porcentaje para ${c.nombre}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^[\d.,]{0,5}$/.test(v)) {
                        setTextos(new Map(textos).set(c.id, v));
                        setError(null);
                      }
                    }}
                  />
                  <span>%</span>
                </span>
                <span className="plan-pct-amount">{formatMoney(Math.round((cents * pct) / 100))}</span>
              </div>
            );
          })}
        </div>

        <div className={`plan-pct-summary${resumen.error ? ' is-error' : ''}`}>
          <div className="plan-pct-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, resumen.pctGasto)}%` }} />
          </div>
          <div className="plan-pct-totals">
            <span>
              Para gastar <b>{formatMoney(resumen.gasto)}</b> · {resumen.pctGasto.toLocaleString('es-ES')} %
            </span>
            <span>
              Para ahorrar <b>{formatMoney(resumen.ahorro)}</b> · {resumen.pctAhorro.toLocaleString('es-ES')} %
            </span>
          </div>
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
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            Crear presupuesto de {monthLabel(mes, false)}
          </button>
        </div>
      </form>
    </Modal>
  );
}
