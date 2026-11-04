import { useMemo, useState } from 'react';
import { useAjustes, useCategorias, useCuentas } from '../db/hooks';
import { actualizarMovimiento, borrarMovimiento, crearMovimiento, validarMovimiento, type DatosMovimiento } from '../db/repo';
import type { Cuenta, Movimiento, TipoMovimiento } from '../db/types';
import { todayISO } from '../lib/dates';
import { AmountInput, useAmountField } from './AmountInput';
import { Modal, useConfirm, useToast } from './Modal';
import { Segmented } from './Segmented';

const TIPOS = [
  { valor: 'gasto', texto: 'Gasto' },
  { valor: 'ingreso', texto: 'Ingreso' },
  { valor: 'transferencia', texto: 'Transferencia' },
] as const;

const CLAVE_ULTIMA_CUENTA = 'neto.ultimaCuenta';

function leerUltimaCuenta(): string | null {
  try {
    return localStorage.getItem(CLAVE_ULTIMA_CUENTA);
  } catch {
    return null;
  }
}

function OpcionesCuentas({ cuentas, autonomo }: { cuentas: Cuenta[]; autonomo: boolean }) {
  if (!autonomo) return <>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</>;
  return (
    <>
      {(['personal', 'negocio'] as const).map((a) => {
        const lista = cuentas.filter((c) => c.ambito === a);
        return lista.length ? (
          <optgroup key={a} label={a === 'personal' ? 'Personal' : 'Negocio'}>
            {lista.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </optgroup>
        ) : null;
      })}
    </>
  );
}

export function MovimientoForm({ movimiento, onClose }: { movimiento?: Movimiento; onClose: () => void }) {
  const ajustes = useAjustes();
  const autonomo = ajustes?.autonomo ?? false;
  const todasCuentas = useCuentas();
  const cuentas = useMemo(
    () => todasCuentas.filter((c) => !c.archivada || c.id === movimiento?.cuentaId || c.id === movimiento?.cuentaDestinoId),
    [todasCuentas, movimiento],
  );
  const categorias = useCategorias();
  const confirmar = useConfirm();
  const avisar = useToast();

  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento?.tipo ?? 'gasto');
  const importe = useAmountField(movimiento?.importe);
  const [fecha, setFecha] = useState(movimiento?.fecha ?? todayISO());
  const ultima = leerUltimaCuenta();
  const cuentaInicial = movimiento?.cuentaId ?? (cuentas.some((c) => c.id === ultima) ? ultima! : cuentas[0]?.id ?? '');
  const [cuentaId, setCuentaId] = useState(cuentaInicial);
  const [destinoId, setDestinoId] = useState(movimiento?.cuentaDestinoId ?? cuentas.find((c) => c.id !== cuentaInicial)?.id ?? '');
  const [categoriaId, setCategoriaId] = useState<string | undefined>(movimiento?.categoriaId);
  const [nota, setNota] = useState(movimiento?.nota ?? '');
  const [error, setError] = useState<string | null>(null);

  const catsTipo = categorias.filter((c) => c.tipo === (tipo === 'ingreso' ? 'ingreso' : 'gasto'));
  const categoriaValida = catsTipo.some((c) => c.id === categoriaId) ? categoriaId : undefined;

  const datos: DatosMovimiento = {
    tipo,
    fecha,
    importe: importe.cents ?? 0,
    cuentaId: cuentaId || (cuentas[0]?.id ?? ''),
    cuentaDestinoId: tipo === 'transferencia' ? destinoId : undefined,
    categoriaId: tipo === 'transferencia' ? undefined : categoriaValida,
    nota,
  };

  const guardar = async () => {
    const e = importe.cents === null && importe.texto !== '' ? 'Escribe el importe como 12,50.' : validarMovimiento(datos);
    if (e) return setError(e);
    try {
      if (movimiento) await actualizarMovimiento(movimiento.id, datos);
      else await crearMovimiento(datos);
      try {
        localStorage.setItem(CLAVE_ULTIMA_CUENTA, datos.cuentaId);
      } catch {
        /* sin almacenamiento local: no pasa nada */
      }
      avisar(movimiento ? 'Movimiento actualizado' : 'Movimiento guardado');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  };

  const eliminar = async () => {
    if (!movimiento) return;
    const ok = await confirmar({ titulo: 'Borrar movimiento', mensaje: 'Se borrará este movimiento. No se puede deshacer.', confirmar: 'Borrar', peligro: true });
    if (!ok) return;
    await borrarMovimiento(movimiento.id);
    avisar('Movimiento borrado');
    onClose();
  };

  if (cuentas.length === 0) {
    return (
      <Modal titulo="Nuevo movimiento" onClose={onClose} pequeno>
        <p className="muted">Antes de apuntar movimientos necesitas al menos una cuenta.</p>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <a className="btn btn-primary" href="#/cuentas" onClick={onClose}>Crear una cuenta</a>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo={movimiento ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
      <form
        className="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <Segmented opciones={TIPOS} valor={tipo} onChange={(t) => { setTipo(t); setError(null); }} block etiqueta="Tipo de movimiento" />

        <div className="field">
          <label className="field-label" htmlFor="mf-importe">Importe</label>
          <AmountInput id="mf-importe" texto={importe.texto} onChange={(t) => { importe.setTexto(t); setError(null); }} grande autoFocus />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="mf-fecha">Fecha</label>
            <input id="mf-fecha" className="input" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="mf-cuenta">{tipo === 'transferencia' ? 'Desde' : 'Cuenta'}</label>
            <select id="mf-cuenta" className="select" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <OpcionesCuentas cuentas={cuentas} autonomo={autonomo} />
            </select>
          </div>
        </div>

        {tipo === 'transferencia' ? (
          <div className="field">
            <label className="field-label" htmlFor="mf-destino">Hacia</label>
            <select id="mf-destino" className="select" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              <option value="" disabled>Elige una cuenta</option>
              <OpcionesCuentas cuentas={cuentas.filter((c) => c.id !== cuentaId)} autonomo={autonomo} />
            </select>
            <span className="field-hint">Mover dinero entre tus cuentas no cuenta como gasto ni como ingreso.</span>
          </div>
        ) : (
          <div className="field">
            <span className="field-label">Categoría</span>
            <div className="chips" role="group" aria-label="Categoría">
              {catsTipo.map((c) => (
                <button key={c.id} type="button" className="chip" aria-pressed={c.id === categoriaValida} onClick={() => { setCategoriaId(c.id); setError(null); }}>
                  <span className="dot" style={{ background: c.color }} />
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="mf-nota">Nota</label>
          <input id="mf-nota" className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional, p. ej. «Mercadona»" maxLength={140} />
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="modal-footer">
          {movimiento && <button type="button" className="btn btn-danger left" onClick={eliminar}>Borrar</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
