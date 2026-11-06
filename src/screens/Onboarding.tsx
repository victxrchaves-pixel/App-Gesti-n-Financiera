import { useState } from 'react';
import { colorCategoria, config } from '../config/neto.config';
import { aplicarPlanPorcentajes } from '../db/budgets';
import { db } from '../db/db';
import { completarInicio, crearCuenta } from '../db/repo';
import type { Categoria } from '../db/types';
import { monthKey, todayISO } from '../lib/dates';
import { iconoCategoria } from '../lib/iconos';
import { formatMoney } from '../lib/money';
import { limitesPlan, plantillaPorId, porcentajesIniciales, resumenPlan } from '../lib/planPorcentajes';
import { ir } from '../router';
import { AmountInput, useAmountField } from '../ui/AmountInput';
import { CategoryIcon } from '../ui/CategoryIcon';
import { BrandMark } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';

// Categorías con las que empieza la app, para enseñar el reparto antes de crearlas.
const CATEGORIAS_INICIALES: Categoria[] = config.categoriasIniciales.gasto.map((c, i) => ({
  id: c.nombre,
  nombre: c.nombre,
  tipo: 'gasto',
  color: c.color,
  orden: i,
}));
const PLANTILLAS = config.presupuestos.plantillas.map((p) => ({ valor: p.id, texto: p.nombre }));

export function Onboarding() {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState('');
  const [autonomo, setAutonomo] = useState<boolean | null>(null);
  const [cuenta, setCuenta] = useState('Cuenta principal');
  const saldo = useAmountField();
  const [conCuenta, setConCuenta] = useState(true);
  const ingreso = useAmountField();
  const [plantilla, setPlantilla] = useState<string>(config.presupuestos.plantillas[0].id);
  const [error, setError] = useState<string | null>(null);

  const porcentajes = porcentajesIniciales(plantillaPorId(plantilla), CATEGORIAS_INICIALES);
  const resumen = resumenPlan(ingreso.cents ?? 0, porcentajes);

  const pasarAlPresupuesto = (crearla: boolean) => {
    if (crearla && saldo.texto !== '' && saldo.cents === null) return setError('Escribe el saldo como 1.234,56.');
    if (crearla && !cuenta.trim()) return setError('Ponle un nombre a la cuenta.');
    setConCuenta(crearla);
    setError(null);
    setPaso(3);
  };

  const terminar = async (conPresupuesto: boolean) => {
    if (conPresupuesto && (!ingreso.cents || ingreso.cents <= 0)) return setError('Escribe cuánto ingresas al mes.');
    await completarInicio({ nombre: nombre.trim(), autonomo: autonomo ?? false });
    if (conCuenta)
      await crearCuenta({ nombre: cuenta.trim(), tipo: 'banco', ambito: 'personal', saldoInicial: saldo.cents ?? 0 });
    if (conPresupuesto) {
      const categorias = await db.categorias.toArray();
      const limites = limitesPlan(ingreso.cents!, porcentajesIniciales(plantillaPorId(plantilla), categorias));
      await aplicarPlanPorcentajes(monthKey(todayISO()), limites);
    }
    ir('inicio');
  };

  return (
    <div className="onboarding">
      <div className="card onboarding-card">
        <div className="steps" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i <= paso ? 'on' : ''} />
          ))}
        </div>

        {paso === 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (nombre.trim()) setPaso(1);
            }}
          >
            <div className="brand-mark" style={{ width: 52, height: 52, borderRadius: 14, marginTop: 28 }}>
              <BrandMark size={26} />
            </div>
            <h1 className="onboarding-title">Te damos la bienvenida a Neto</h1>
            <p className="onboarding-text">
              Tus cuentas, tus gastos y tus ahorros, claros y en un solo sitio. Todo se guarda en este ordenador.
            </p>
            <div className="field">
              <label className="field-label" htmlFor="ob-nombre">
                ¿Cómo te llamas?
              </label>
              <input
                id="ob-nombre"
                className="input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoFocus
                maxLength={40}
                placeholder="Tu nombre"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary btn-lg" type="submit" disabled={!nombre.trim()}>
                Continuar
              </button>
            </div>
          </form>
        )}

        {paso === 1 && (
          <div>
            <h1 className="onboarding-title">¿Trabajas como autónomo?</h1>
            <p className="onboarding-text">
              Si dices que sí, Neto añade un apartado para tu negocio: facturas, gastos e impuestos. Puedes cambiarlo
              cuando quieras en Ajustes.
            </p>
            <div className="choice-grid">
              <button
                type="button"
                className="choice"
                aria-pressed={autonomo === true}
                onClick={() => setAutonomo(true)}
              >
                <span className="choice-title">Sí</span>
                <span className="choice-desc">Finanzas personales y modo autónomo.</span>
              </button>
              <button
                type="button"
                className="choice"
                aria-pressed={autonomo === false}
                onClick={() => setAutonomo(false)}
              >
                <span className="choice-title">No</span>
                <span className="choice-desc">Solo finanzas personales.</span>
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPaso(0)}>
                Atrás
              </button>
              <button className="btn btn-primary btn-lg" disabled={autonomo === null} onClick={() => setPaso(2)}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pasarAlPresupuesto(true);
            }}
          >
            <h1 className="onboarding-title">Tu primera cuenta</h1>
            <p className="onboarding-text">
              Empieza por la cuenta que más usas. Luego podrás añadir el resto: ahorro, efectivo…
            </p>
            <div className="modal-body">
              <div className="field">
                <label className="field-label" htmlFor="ob-cuenta">
                  Nombre
                </label>
                <input
                  id="ob-cuenta"
                  className="input"
                  value={cuenta}
                  onChange={(e) => {
                    setCuenta(e.target.value);
                    setError(null);
                  }}
                  maxLength={60}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ob-saldo">
                  ¿Cuánto tienes hoy?
                </label>
                <AmountInput
                  id="ob-saldo"
                  texto={saldo.texto}
                  onChange={(t) => {
                    saldo.setTexto(t);
                    setError(null);
                  }}
                  permitirNegativo
                  autoFocus
                />
              </div>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost left" onClick={() => pasarAlPresupuesto(false)}>
                Ahora no
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPaso(1)}>
                Atrás
              </button>
              <button className="btn btn-primary btn-lg" type="submit">
                Continuar
              </button>
            </div>
          </form>
        )}

        {paso === 3 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void terminar(true);
            }}
          >
            <h1 className="onboarding-title">Tu presupuesto en un minuto</h1>
            <p className="onboarding-text">
              Dinos cuánto ingresas al mes y Neto repartirá un límite para cada categoría. Podrás cambiarlo cuando
              quieras en Presupuestos.
            </p>
            <div className="modal-body">
              <div className="field">
                <label className="field-label" htmlFor="ob-ingreso">
                  ¿Cuánto ingresas al mes?
                </label>
                <AmountInput
                  id="ob-ingreso"
                  texto={ingreso.texto}
                  onChange={(t) => {
                    ingreso.setTexto(t);
                    setError(null);
                  }}
                  autoFocus
                />
                <span className="field-hint">Tu nómina u otros ingresos habituales, ya sin impuestos.</span>
              </div>
              <div className="field">
                <span className="field-label">Reparto</span>
                <Segmented opciones={PLANTILLAS} valor={plantilla} onChange={setPlantilla} block etiqueta="Reparto" />
                <span className="field-hint">
                  {plantillaPorId(plantilla).resumen} · {plantillaPorId(plantilla).descripcion}
                </span>
              </div>
              {(ingreso.cents ?? 0) > 0 && (
                <div className="onboarding-plan">
                  {CATEGORIAS_INICIALES.filter((c) => (porcentajes.get(c.id) ?? 0) > 0).map((c) => (
                    <span key={c.id} className="onboarding-plan-item">
                      <CategoryIcon icono={iconoCategoria(c)} color={colorCategoria(c.color)} size={28} />
                      <span>{c.nombre}</span>
                      <b>{formatMoney(Math.round(((ingreso.cents ?? 0) * (porcentajes.get(c.id) ?? 0)) / 100))}</b>
                    </span>
                  ))}
                  <span className="onboarding-plan-saving">
                    Para ahorrar cada mes: <b>{formatMoney(resumen.ahorro)}</b>
                  </span>
                </div>
              )}
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost left" onClick={() => void terminar(false)}>
                Ahora no
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPaso(2)}>
                Atrás
              </button>
              <button className="btn btn-primary btn-lg" type="submit">
                Crear y empezar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
