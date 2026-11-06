import { useState } from 'react';
import { completarInicio, crearCuenta } from '../db/repo';
import { ir } from '../router';
import { AmountInput, useAmountField } from '../ui/AmountInput';
import { BrandMark } from '../ui/Icon';

export function Onboarding() {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState('');
  const [autonomo, setAutonomo] = useState<boolean | null>(null);
  const [cuenta, setCuenta] = useState('Cuenta principal');
  const saldo = useAmountField();
  const [error, setError] = useState<string | null>(null);

  const terminar = async (conCuenta: boolean) => {
    if (conCuenta && saldo.texto !== '' && saldo.cents === null) return setError('Escribe el saldo como 1.234,56.');
    if (conCuenta && !cuenta.trim()) return setError('Ponle un nombre a la cuenta.');
    await completarInicio({ nombre: nombre.trim(), autonomo: autonomo ?? false });
    if (conCuenta)
      await crearCuenta({ nombre: cuenta.trim(), tipo: 'banco', ambito: 'personal', saldoInicial: saldo.cents ?? 0 });
    ir('inicio');
  };

  return (
    <div className="onboarding">
      <div className="card onboarding-card">
        <div className="steps" aria-hidden="true">
          {[0, 1, 2].map((i) => (
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
              void terminar(true);
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
              <button type="button" className="btn btn-ghost left" onClick={() => void terminar(false)}>
                Ahora no
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPaso(1)}>
                Atrás
              </button>
              <button className="btn btn-primary btn-lg" type="submit">
                Empezar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
