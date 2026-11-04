import { useState } from 'react';
import { config } from '../config/neto.config';
import { useAjustes } from '../db/hooks';
import { actualizarCuenta, borrarCuenta, crearCuenta, movimientosDeCuenta } from '../db/repo';
import type { Ambito, Cuenta, TipoCuenta } from '../db/types';
import { AmountInput, useAmountField } from './AmountInput';
import { Modal, useConfirm, useToast } from './Modal';
import { Segmented } from './Segmented';

const TIPOS = config.tiposCuenta.map((t) => ({ valor: t.id as TipoCuenta, texto: t.nombre }));
const AMBITOS = [
  { valor: 'personal', texto: 'Personal' },
  { valor: 'negocio', texto: 'Negocio' },
] as const;

export function CuentaForm({ cuenta, onClose, ambitoInicial = 'personal' }: { cuenta?: Cuenta; onClose: () => void; ambitoInicial?: Ambito }) {
  const ajustes = useAjustes();
  const confirmar = useConfirm();
  const avisar = useToast();
  const [nombre, setNombre] = useState(cuenta?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoCuenta>(cuenta?.tipo ?? 'banco');
  const [ambito, setAmbito] = useState<Ambito>(cuenta?.ambito ?? ambitoInicial);
  const saldo = useAmountField(cuenta?.saldoInicial ?? undefined);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!nombre.trim()) return setError('Ponle un nombre a la cuenta.');
    if (saldo.texto !== '' && saldo.cents === null) return setError('Escribe el saldo como 1.234,56.');
    const datos = { nombre: nombre.trim(), tipo, ambito, saldoInicial: saldo.cents ?? 0 };
    if (cuenta) await actualizarCuenta(cuenta.id, datos);
    else await crearCuenta(datos);
    avisar(cuenta ? 'Cuenta actualizada' : 'Cuenta creada');
    onClose();
  };

  const archivar = async () => {
    if (!cuenta) return;
    await actualizarCuenta(cuenta.id, { archivada: !cuenta.archivada });
    avisar(cuenta.archivada ? 'Cuenta recuperada' : 'Cuenta archivada');
    onClose();
  };

  const eliminar = async () => {
    if (!cuenta) return;
    const n = await movimientosDeCuenta(cuenta.id);
    if (n > 0) {
      await confirmar({
        titulo: 'No se puede borrar',
        mensaje: `Esta cuenta tiene ${n} movimiento${n === 1 ? '' : 's'}. Puedes archivarla: dejará de contar en tu patrimonio pero conservarás su historial.`,
        confirmar: 'Entendido',
      });
      return;
    }
    if (!(await confirmar({ titulo: 'Borrar cuenta', mensaje: `Se borrará «${cuenta.nombre}».`, confirmar: 'Borrar', peligro: true }))) return;
    await borrarCuenta(cuenta.id);
    avisar('Cuenta borrada');
    onClose();
  };

  return (
    <Modal titulo={cuenta ? 'Editar cuenta' : 'Nueva cuenta'} onClose={onClose}>
      <form className="modal-body" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <div className="field">
          <label className="field-label" htmlFor="cf-nombre">Nombre</label>
          <input id="cf-nombre" className="input" value={nombre} onChange={(e) => { setNombre(e.target.value); setError(null); }} placeholder="p. ej. Cuenta nómina" data-autofocus maxLength={60} />
        </div>
        <div className="field">
          <span className="field-label">Tipo</span>
          <Segmented opciones={TIPOS} valor={tipo} onChange={setTipo} block etiqueta="Tipo de cuenta" />
        </div>
        {ajustes?.autonomo && (
          <div className="field">
            <span className="field-label">¿De quién es el dinero?</span>
            <Segmented opciones={AMBITOS} valor={ambito} onChange={setAmbito} block etiqueta="Ámbito" />
            <span className="field-hint">Las cuentas del negocio y las personales se cuentan por separado.</span>
          </div>
        )}
        <div className="field">
          <label className="field-label" htmlFor="cf-saldo">{cuenta ? 'Saldo inicial' : 'Saldo actual'}</label>
          <AmountInput id="cf-saldo" texto={saldo.texto} onChange={(t) => { saldo.setTexto(t); setError(null); }} permitirNegativo />
          <span className="field-hint">
            {cuenta
              ? 'El saldo con el que diste de alta la cuenta. El saldo actual se calcula sumando los movimientos.'
              : 'Lo que tienes hoy. A partir de aquí, el saldo se actualiza con tus movimientos.'}
          </span>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-footer">
          {cuenta && (
            <>
              <button type="button" className="btn btn-ghost left" onClick={eliminar}>Borrar</button>
              <button type="button" className="btn btn-secondary" onClick={archivar}>{cuenta.archivada ? 'Recuperar' : 'Archivar'}</button>
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
