import { Icon } from './Icon';
import { iconoCategoria } from '../lib/iconos';
import { colorCategoria } from '../config/neto.config';
import { useMemo, useState } from 'react';
import { useAjustes, useCategorias, useCuentas, useMovimientos } from '../db/hooks';
import {
  actualizarMovimiento,
  borrarMovimiento,
  crearMovimiento,
  validarMovimiento,
  type DatosMovimiento,
} from '../db/repo';
import type { Cuenta, Movimiento, TipoMovimiento } from '../db/types';
import { RegistrarDevolucion } from './RegistrarDevolucion';
import { parseMoney, formatMoney } from '../lib/money';
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
  if (!autonomo)
    return (
      <>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </>
    );
  return (
    <>
      {(['personal', 'negocio'] as const).map((a) => {
        const lista = cuentas.filter((c) => c.ambito === a);
        return lista.length ? (
          <optgroup key={a} label={a === 'personal' ? 'Personal' : 'Negocio'}>
            {lista.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </>
  );
}

export function MovimientoForm({
  movimiento,
  tipoInicial,
  cuentaPreferida,
  onClose,
}: {
  movimiento?: Movimiento;
  tipoInicial?: TipoMovimiento;
  /** Cuenta ya elegida al abrir el formulario (por ejemplo, desde la ficha de una cuenta). */
  cuentaPreferida?: string;
  onClose: () => void;
}) {
  const ajustes = useAjustes();
  const autonomo = ajustes?.autonomo ?? false;
  const todasCuentas = useCuentas();
  const cuentas = useMemo(
    () =>
      todasCuentas.filter(
        (c) =>
          (!c.eliminada && !c.archivada && !c.cuentaPadreId && !c.ahorroGeneral) ||
          c.id === movimiento?.cuentaId ||
          c.id === movimiento?.cuentaDestinoId,
      ),
    [todasCuentas, movimiento],
  );
  const categorias = useCategorias();
  const movimientos = useMovimientos();
  const confirmar = useConfirm();
  const avisar = useToast();

  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento?.tipo ?? tipoInicial ?? 'gasto');
  const importe = useAmountField(movimiento?.importe);
  const [fecha, setFecha] = useState(movimiento?.fecha ?? todayISO());
  const ultima = cuentaPreferida ?? leerUltimaCuenta();
  const cuentaInicial =
    movimiento?.cuentaId ?? (cuentas.some((c) => c.id === ultima) ? ultima! : (cuentas[0]?.id ?? ''));
  const [cuentaId, setCuentaId] = useState(cuentaInicial);
  const [destinoId, setDestinoId] = useState(
    movimiento?.cuentaDestinoId ?? cuentas.find((c) => c.id !== cuentaInicial)?.id ?? '',
  );
  const [categoriaId, setCategoriaId] = useState<string | undefined>(movimiento?.categoriaId);
  const [nota, setNota] = useState(movimiento?.nota ?? '');
  const [busy, setBusy] = useState(false);
  const [devolver, setDevolver] = useState(false);
  const [dividir, setDividir] = useState(!!movimiento?.reparto?.length);
  const [partes, setPartes] = useState(
    () =>
      movimiento?.reparto?.map((p) => ({
        categoriaId: p.categoriaId,
        texto: String(p.importe / 100).replace('.', ','),
      })) ?? [
        { categoriaId: '', texto: '' },
        { categoriaId: '', texto: '' },
      ],
  );
  const [todasCategorias, setTodasCategorias] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catsTipo = categorias.filter((c) => c.tipo === (tipo === 'ingreso' ? 'ingreso' : 'gasto'));
  const frecuentes = [...catsTipo].sort(
    (a, b) =>
      movimientos.filter(
        (m) => m.tipo === tipo && (m.categoriaId === b.id || m.reparto?.some((p) => p.categoriaId === b.id)),
      ).length -
      movimientos.filter(
        (m) => m.tipo === tipo && (m.categoriaId === a.id || m.reparto?.some((p) => p.categoriaId === a.id)),
      ).length,
  );
  const visibles = todasCategorias ? frecuentes : frecuentes.filter((c, i) => i < 6 || c.id === categoriaId);
  const reparto =
    dividir && tipo !== 'transferencia'
      ? partes.map((p) => ({ categoriaId: p.categoriaId, importe: parseMoney(p.texto) ?? 0 }))
      : undefined;
  const sumaReparto = reparto?.reduce((s, p) => s + p.importe, 0) ?? 0;
  const categoriaValida = catsTipo.some((c) => c.id === categoriaId) ? categoriaId : undefined;

  const datos: DatosMovimiento = {
    tipo,
    fecha,
    importe: importe.cents ?? 0,
    cuentaId: cuentaId || (cuentas[0]?.id ?? ''),
    cuentaDestinoId: tipo === 'transferencia' ? destinoId : undefined,
    categoriaId: tipo === 'transferencia' ? undefined : (reparto?.[0]?.categoriaId ?? categoriaValida),
    nota,
    reparto,
  };

  const guardar = async () => {
    if (busy) return;
    const e =
      importe.cents === null && importe.texto !== '' ? 'Escribe el importe como 12,50.' : validarMovimiento(datos);
    if (e) return setError(e);
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async () => {
    if (!movimiento) return;
    const ok = await confirmar({
      titulo: 'Borrar movimiento',
      mensaje: 'Se borrará este movimiento. No se puede deshacer.',
      confirmar: 'Borrar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await borrarMovimiento(movimiento.id);
      avisar('Movimiento borrado');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    }
  };

  if (movimiento?.devolucionDe)
    return (
      <Modal titulo="Devolución registrada" onClose={onClose}>
        <div className="modal-body">
          <p>
            Has recibido {formatMoney(movimiento.importe)} como devolución de un gasto. Reduce el gasto de sus
            categorías y no cuenta como un ingreso nuevo.
          </p>
          <p className="field-hint">Para corregirla, anúlala y vuelve a registrarla desde el gasto original.</p>
          {error && <p role="alert">{error}</p>}
          <div className="modal-footer">
            <button className="btn btn-danger" onClick={() => void eliminar()}>
              Anular devolución
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    );

  if (cuentas.length === 0) {
    return (
      <Modal titulo="Nuevo movimiento" onClose={onClose} pequeno>
        <p className="muted">Antes de apuntar movimientos necesitas al menos una cuenta.</p>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <a className="btn btn-primary" href="#/cuentas" onClick={onClose}>
            Crear una cuenta
          </a>
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
        <Segmented
          opciones={TIPOS}
          valor={tipo}
          onChange={(t) => {
            setTipo(t);
            setDividir(false);
            setTodasCategorias(false);
            setPartes([
              { categoriaId: '', texto: '' },
              { categoriaId: '', texto: '' },
            ]);
            setError(null);
          }}
          block
          etiqueta="Tipo de movimiento"
        />

        <div className="field">
          <label className="field-label" htmlFor="mf-importe">
            Importe
          </label>
          <AmountInput
            id="mf-importe"
            texto={importe.texto}
            onChange={(t) => {
              importe.setTexto(t);
              setError(null);
            }}
            grande
            autoFocus
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="mf-fecha">
              Fecha
            </label>
            <input
              id="mf-fecha"
              className="input"
              type="date"
              max={todayISO()}
              value={fecha}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="mf-cuenta">
              {tipo === 'transferencia' ? 'Desde' : 'Cuenta'}
            </label>
            <select id="mf-cuenta" className="select" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <OpcionesCuentas cuentas={cuentas} autonomo={autonomo} />
            </select>
          </div>
        </div>

        {tipo === 'transferencia' ? (
          <div className="field">
            <label className="field-label" htmlFor="mf-destino">
              Hacia
            </label>
            <select id="mf-destino" className="select" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
              <option value="" disabled>
                Elige una cuenta
              </option>
              <OpcionesCuentas cuentas={cuentas.filter((c) => c.id !== cuentaId)} autonomo={autonomo} />
            </select>
            <span className="field-hint">Mover dinero entre tus cuentas no cuenta como gasto ni como ingreso.</span>
          </div>
        ) : (
          <div className="field">
            <div className="movement-category-heading">
              <span className="field-label">{dividir ? 'Reparto por categorías' : 'Categorías frecuentes'}</span>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDividir(!dividir)}>
                {dividir ? 'Usar una categoría' : 'Dividir importe'}
              </button>
            </div>
            {dividir ? (
              <div className="movement-splits">
                {partes.map((p, i) => (
                  <div className="movement-split" key={i}>
                    <div className="field">
                      <label className="sr-only" htmlFor={`split-cat-${i}`}>
                        Categoría del reparto {i + 1}
                      </label>
                      <select
                        id={`split-cat-${i}`}
                        className="select"
                        value={p.categoriaId}
                        onChange={(e) =>
                          setPartes((ps) => ps.map((p, j) => (j === i ? { ...p, categoriaId: e.target.value } : p)))
                        }
                      >
                        <option value="">Elige categoría</option>
                        {catsTipo.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="sr-only" htmlFor={`split-amount-${i}`}>
                        Importe del reparto {i + 1}
                      </label>
                      <AmountInput
                        id={`split-amount-${i}`}
                        texto={p.texto}
                        onChange={(texto) => setPartes((ps) => ps.map((p, j) => (j === i ? { ...p, texto } : p)))}
                      />
                    </div>
                    {partes.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label={`Quitar reparto ${i + 1}`}
                        onClick={() => setPartes((ps) => ps.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <div className="split-summary">
                  <span>
                    Repartido {formatMoney(sumaReparto)} de {formatMoney(importe.cents ?? 0)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPartes((ps) => [...ps, { categoriaId: '', texto: '' }])}
                  >
                    Añadir categoría
                  </button>
                </div>
                <p className="field-hint">
                  Es un solo pago. El reparto se refleja en cada categoría y presupuesto sin duplicar el movimiento.
                </p>
              </div>
            ) : (
              <>
                <div className="chips" role="group" aria-label="Categoría">
                  {visibles.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="chip"
                      aria-pressed={c.id === categoriaValida}
                      onClick={() => {
                        setCategoriaId(c.id);
                        setError(null);
                      }}
                    >
                      <span className="chip-icon" style={{ color: colorCategoria(c.color) }}>
                        <Icon name={iconoCategoria(c)} size={16} stroke={2} />
                      </span>
                      {c.nombre}
                    </button>
                  ))}
                </div>
                {frecuentes.length > 6 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setTodasCategorias(!todasCategorias)}
                  >
                    {todasCategorias ? 'Ver frecuentes' : 'Ver todas las categorías'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="mf-nota">
            Nota
          </label>
          <input
            id="mf-nota"
            className="input"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Opcional, p. ej. «Mercadona»"
            maxLength={140}
          />
        </div>

        <p className="field-hint">
          Para aportar o gastar dinero de una meta, hazlo desde{' '}
          <a href="#/metas" onClick={onClose}>
            Metas
          </a>
          .
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="modal-footer">
          {movimiento?.tipo === 'gasto' && (
            <button type="button" className="btn btn-secondary" onClick={() => setDevolver(true)}>
              Registrar devolución
            </button>
          )}
          {movimiento && (
            <button type="button" className="btn btn-danger left" onClick={eliminar}>
              Borrar
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
      {devolver && movimiento && <RegistrarDevolucion gasto={movimiento} cerrar={() => setDevolver(false)} />}
    </Modal>
  );
}
