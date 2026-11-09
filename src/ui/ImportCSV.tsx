import { useCategoriasEspacio } from './Espacio';
import { useMemo, useState } from 'react';
import { useCuentas, useMovimientos } from '../db/hooks';
import { leerCSV, prepararCSV, type ColumnasCSV } from '../lib/csv';
import { importarCSV } from '../db/csv';
import { saldosPorCuenta } from '../lib/balances';
import { formatMoney } from '../lib/money';
import { newId } from '../lib/id';
import { Modal, useToast } from './Modal';
import { contar } from '../lib/plural';
type Archivo = ReturnType<typeof leerCSV>;
export function ImportCSV({ cerrar }: { cerrar: () => void }) {
  const cuentas = useCuentas().filter(
      (c) => !c.eliminada && !c.archivada && !c.cuentaPadreId && !c.ahorroGeneral && c.ambito === 'personal',
    ),
    cats = useCategoriasEspacio(),
    movs = useMovimientos(),
    avisar = useToast();
  const [archivo, setArchivo] = useState<Archivo | null>(null),
    [cuenta, setCuenta] = useState(cuentas[0]?.id ?? ''),
    [columnas, setColumnas] = useState<ColumnasCSV>({ fecha: 0, nota: 1, importe: 2, modo: 'signo' }),
    [excluidas, setExcluidas] = useState<Set<number>>(new Set()),
    [incluidas, setIncluidas] = useState<Set<number>>(new Set()),
    [categorias, setCategorias] = useState<Record<number, string>>({}),
    [conservar, setConservar] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [pagina, setPagina] = useState(0),
    [loteId] = useState(newId);
  const cuentaActual = cuentas.some((c) => c.id === cuenta) ? cuenta : (cuentas[0]?.id ?? '');
  const filas = useMemo(
    () => (archivo ? prepararCSV(archivo.filas, columnas, cuentaActual, movs) : []),
    [archivo, columnas, cuentaActual, movs],
  );
  const categoriaFila = (f: (typeof filas)[number]) =>
    categorias[f.linea] ??
    cats.find((c) => c.tipo === f.tipo && c.nombre === (f.tipo === 'gasto' ? 'Otros' : 'Otros ingresos'))?.id ??
    cats.find((c) => c.tipo === f.tipo)?.id ??
    '';
  const elegida = (f: (typeof filas)[number]) =>
    !f.error && !excluidas.has(f.linea) && (!f.duplicado || incluidas.has(f.linea));
  const seleccion = filas.filter(elegida),
    neto = seleccion.reduce((s, f) => s + f.importe * (f.tipo === 'gasto' ? -1 : 1), 0),
    saldo = saldosPorCuenta(cuentas, movs).get(cuentaActual) ?? 0;
  const totalValido = Number.isSafeInteger(neto) && Number.isSafeInteger(saldo + neto);
  const reset = () => {
    setExcluidas(new Set());
    setIncluidas(new Set());
    setCategorias({});
    setPagina(0);
  };
  return (
    <Modal amplio titulo="Importar movimientos CSV" onClose={cerrar}>
      <form
        className="modal-body csv-import"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !archivo) return;
          setBusy(true);
          setError('');
          try {
            const r = await importarCSV({
              filas: archivo.filas,
              columnas,
              cuentaId: cuentaActual,
              seleccion: seleccion.map((f) => ({
                linea: f.linea,
                categoriaId: categoriaFila(f),
                permitirDuplicado: incluidas.has(f.linea),
              })),
              conservarSaldo: conservar,
              loteId,
            });
            avisar(
              `${contar(r.guardados, 'movimiento importado', 'movimientos importados')}${r.omitidos ? ` · ${contar(r.omitidos, 'duplicado omitido', 'duplicados omitidos')}` : ''}`,
            );
            cerrar();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo importar.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          Elige un extracto CSV en euros con cabecera. Revisa las columnas y categorías antes de guardar. Excluye los
          traspasos entre tus cuentas para registrarlos como transferencias y evitar contarlos como gastos o ingresos.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="csv-file">
            Archivo CSV
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 5 * 1024 * 1024) throw new Error('El archivo debe ocupar menos de 5 MB.');
                const a = leerCSV(await f.text());
                setArchivo(a);
                const encontrar = (exp: RegExp, valor: number) => {
                  const n = a.cabecera.findIndex((c) => exp.test(c));
                  return n >= 0 ? n : valor;
                };
                setColumnas({
                  fecha: encontrar(/fecha|date/i, 0),
                  nota: encontrar(/concepto|descripcion|descripción|nota|description/i, 1),
                  importe: encontrar(/importe|amount|cantidad/i, 2),
                  modo: 'signo',
                });
                reset();
                setError('');
              } catch (e) {
                setArchivo(null);
                setError(e instanceof Error ? e.message : 'No se pudo leer.');
              }
            }}
          />
        </div>
        {archivo && (
          <>
            <div className="csv-mapping">
              <div className="field">
                <label className="field-label" htmlFor="csv-account">
                  Cuenta del extracto
                </label>
                <select
                  id="csv-account"
                  className="select"
                  value={cuentaActual}
                  onChange={(e) => {
                    setCuenta(e.target.value);
                    reset();
                  }}
                >
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {(['fecha', 'nota', 'importe'] as const).map((c) => (
                <div className="field" key={c}>
                  <label className="field-label" htmlFor={`csv-${c}`}>
                    Columna de {c === 'nota' ? 'concepto' : c}
                  </label>
                  <select
                    id={`csv-${c}`}
                    className="select"
                    value={columnas[c]}
                    onChange={(e) => {
                      setColumnas((x) => ({ ...x, [c]: Number(e.target.value) }));
                      reset();
                    }}
                  >
                    {archivo.cabecera.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Columna ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="csv-sign">
                Cómo interpretar los importes
              </label>
              <select
                id="csv-sign"
                className="select"
                value={columnas.modo}
                onChange={(e) => {
                  setColumnas((c) => ({ ...c, modo: e.target.value as ColumnasCSV['modo'] }));
                  reset();
                }}
              >
                <option value="signo">Negativos: gastos · positivos: ingresos</option>
                <option value="gasto">Todos son gastos</option>
                <option value="ingreso">Todos son ingresos</option>
              </select>
            </div>
            <div className="csv-summary">
              <strong>
                {seleccion.length} de {filas.length} movimientos seleccionados
              </strong>
              <span>
                {filas.filter((f) => f.duplicado).length} posibles duplicados · {filas.filter((f) => f.error).length}{' '}
                filas con errores
              </span>
            </div>
            <div className="csv-preview" tabIndex={0} role="region" aria-label="Vista previa del CSV">
              <table>
                <thead>
                  <tr>
                    <th>Incluir</th>
                    <th>Fecha y concepto</th>
                    <th>Importe</th>
                    <th>Categoría</th>
                    <th>Revisión</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.slice(pagina * 50, (pagina + 1) * 50).map((f) => (
                    <tr key={f.linea}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Incluir fila ${f.linea}`}
                          disabled={!!f.error}
                          checked={elegida(f)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExcluidas((s) => {
                              const n = new Set(s);
                              if (checked) n.delete(f.linea);
                              else n.add(f.linea);
                              return n;
                            });
                            if (f.duplicado)
                              setIncluidas((s) => {
                                const n = new Set(s);
                                if (checked) n.add(f.linea);
                                else n.delete(f.linea);
                                return n;
                              });
                          }}
                        />
                      </td>
                      <td>
                        <strong>{f.fecha || 'Sin fecha'}</strong>
                        <span>{f.nota || 'Sin concepto'}</span>
                      </td>
                      <td>{formatMoney(f.importe * (f.tipo === 'gasto' ? -1 : 1))}</td>
                      <td>
                        <select
                          className="select"
                          aria-label={`Categoría fila ${f.linea}`}
                          value={categoriaFila(f)}
                          onChange={(e) => setCategorias((c) => ({ ...c, [f.linea]: e.target.value }))}
                        >
                          {cats
                            .filter((c) => c.tipo === f.tipo)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>{f.error ?? (f.duplicado ? 'Posible duplicado' : 'Nuevo')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filas.length > 50 && (
              <div className="page-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!pagina}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {pagina + 1} de {Math.ceil(filas.length / 50)}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={(pagina + 1) * 50 >= filas.length}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
            <label className="goal-check">
              <input type="checkbox" checked={conservar} onChange={(e) => setConservar(e.target.checked)} />
              Conservar el saldo actual de esta cuenta
            </label>
            <p className="field-hint">
              Si el saldo de tu cuenta ya incluye estos movimientos históricos, mantén esta opción: ajustará el saldo
              inicial para no contarlos dos veces. Desmárcala si son movimientos que todavía faltan en tu saldo.
            </p>
            <div className="detail-highlight">
              <span>
                Saldo actual {formatMoney(saldo)} · efecto del extracto{' '}
                {Number.isSafeInteger(neto) ? formatMoney(neto) : 'Supera el límite permitido'}
              </span>
              <strong>
                Saldo después: {totalValido ? formatMoney(conservar ? saldo : saldo + neto) : 'Revisa el importe total'}
              </strong>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy || !seleccion.length || !cuentas.length || !totalValido}>
            {busy ? 'Importando…' : `Importar ${contar(seleccion.length, 'movimiento', 'movimientos')}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
