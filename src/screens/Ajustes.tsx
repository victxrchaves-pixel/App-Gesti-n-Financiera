import { COLORES_UX, colorCategoriaSugerido } from '../lib/colors';
import { ColorPicker } from '../ui/ColorPicker';
import { useRef, useState } from 'react';
import { colorCategoria, config } from '../config/neto.config';
import { cargarEjemplo } from '../db/ejemplo';
import { useAjustes, useCategorias, useMovimientos } from '../db/hooks';
import { actualizarCategoria, borrarCategoria, borrarTodo, crearCategoria, guardarAjustes } from '../db/repo';
import type { Categoria, TipoCategoria } from '../db/types';
import { crearCopia, nombreArchivoCopia, restaurarCopia, resumenCopia, validarCopia } from '../lib/backup';
import { guardarArchivo } from '../lib/platform';
import { PageHeader } from '../layout/Shell';
import { ir } from '../router';
import { Icon } from '../ui/Icon';
import { useConfirm, useToast } from '../ui/Modal';
import { Switch } from '../ui/Switch';

const COLORES = [...config.paleta, config.colorOtros];

function FilaCategoria({ c, usos, onBorrar }: { c: Categoria; usos: number; onBorrar: () => void }) {
  const [nombre, setNombre] = useState(c.nombre);
  const [abierta, setAbierta] = useState(false);
  const guardarNombre = () => {
    const n = nombre.trim();
    if (n && n !== c.nombre) void actualizarCategoria(c.id, { nombre: n });
    else setNombre(c.nombre);
  };
  return (
    <div>
      <div className="cat-row">
        <button
          className="color-btn"
          style={{ background: colorCategoria(c.color) }}
          onClick={() => setAbierta(!abierta)}
          aria-label={`Cambiar color de ${c.nombre}`}
        />
        <input
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={guardarNombre}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Nombre de la categoría"
          maxLength={40}
        />
        <span className="faint" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 74, textAlign: 'right' }}>
          {usos} mov.
        </span>
        <button className="btn btn-ghost btn-icon" onClick={onBorrar} aria-label={`Borrar ${c.nombre}`}>
          <Icon name="papelera" size={18} />
        </button>
      </div>
      {abierta && (
        <div className="swatches" style={{ padding: '4px 0 10px 36px' }}>
          <ColorPicker
            etiqueta={`Color de ${c.nombre}`}
            valor={colorCategoria(c.color)}
            onChange={(color) => {
              void actualizarCategoria(c.id, { color });
            }}
            restablecer={() => {
              void actualizarCategoria(c.id, { color: colorCategoriaSugerido(c.nombre) });
            }}
            textoRestablecer="Color sugerido"
          />
          {COLORES.map((col) => (
            <button
              key={col}
              className="swatch"
              style={{ background: col }}
              aria-pressed={col === colorCategoria(c.color)}
              aria-label={`Color ${col}`}
              onClick={() => {
                void actualizarCategoria(c.id, { color: col });
                setAbierta(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BloqueCategorias({
  tipo,
  categorias,
  usos,
}: {
  tipo: TipoCategoria;
  categorias: Categoria[];
  usos: Map<string, number>;
}) {
  const confirmar = useConfirm();
  const avisar = useToast();
  const [nueva, setNueva] = useState('');
  const lista = categorias.filter((c) => c.tipo === tipo);
  const destino = config.categoriaPorDefecto[tipo];

  const borrar = async (c: Categoria) => {
    if (lista.length <= 1) return avisar('Tiene que quedar al menos una categoría.');
    const n = usos.get(c.id) ?? 0;
    const ok = await confirmar({
      titulo: `Borrar «${c.nombre}»`,
      mensaje:
        (n > 0
          ? `Sus ${n} movimientos pasarán a «${c.nombre === destino ? lista.find((x) => x.id !== c.id)?.nombre : destino}».`
          : 'No tiene movimientos.') +
        ' Si tiene presupuestos, sus límites también se trasladarán a la categoría de destino y se sumarán a los que ya existan en cada mes.',
      confirmar: 'Borrar',
      peligro: true,
    });
    if (ok) {
      try {
        await borrarCategoria(c.id);
      } catch (error) {
        avisar(error instanceof Error ? error.message : 'No se pudo borrar la categoría.');
      }
    }
  };

  const anadir = async () => {
    const n = nueva.trim();
    if (!n) return;
    if (lista.some((c) => c.nombre.toLowerCase() === n.toLowerCase()))
      return avisar('Ya existe una categoría con ese nombre.');
    const color = COLORES.find((col) => !lista.some((c) => colorCategoria(c.color) === col)) ?? config.colorOtros;
    await crearCategoria(n, tipo, color);
    setNueva('');
  };

  return (
    <div>
      <h3 className="field-label" style={{ marginBottom: 6 }}>
        {tipo === 'gasto' ? 'Gastos' : 'Ingresos'}
      </h3>
      {lista.map((c) => (
        <FilaCategoria key={c.id} c={c} usos={usos.get(c.id) ?? 0} onBorrar={() => void borrar(c)} />
      ))}
      <form
        className="cat-row"
        onSubmit={(e) => {
          e.preventDefault();
          void anadir();
        }}
      >
        <span style={{ width: 26 }} />
        <input
          className="input"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          placeholder="Nueva categoría"
          maxLength={40}
        />
        <button className="btn btn-secondary btn-sm" type="submit" disabled={!nueva.trim()}>
          Añadir
        </button>
      </form>
    </div>
  );
}

export function Ajustes() {
  const ajustes = useAjustes();
  const categorias = useCategorias();
  const movimientos = useMovimientos();
  const confirmar = useConfirm();
  const avisar = useToast();
  const archivo = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState<string | null>(null);

  const usos = new Map<string, number>();
  for (const m of movimientos)
    for (const id of new Set(m.reparto?.map((p) => p.categoriaId) ?? (m.categoriaId ? [m.categoriaId] : [])))
      usos.set(id, (usos.get(id) ?? 0) + 1);

  if (!ajustes) return null;

  const cambiarAutonomo = async (v: boolean) => {
    if (!v) {
      const ok = await confirmar({
        titulo: 'Desactivar el modo autónomo',
        mensaje:
          'Dejarás de ver Facturas, Gastos e Impuestos. No se borra nada: si lo vuelves a activar, todo seguirá ahí.',
        confirmar: 'Desactivar',
      });
      if (!ok) return;
    }
    await guardarAjustes({ autonomo: v });
    avisar(v ? 'Modo autónomo activado' : 'Modo autónomo desactivado');
  };

  const exportar = async () => {
    try {
      const copia = await crearCopia();
      const ok = await guardarArchivo(nombreArchivoCopia(), JSON.stringify(copia, null, 2), {
        descripcion: 'Copia de Neto',
        extension: 'json',
        tipoMime: 'application/json',
      });
      if (ok) {
        await guardarAjustes({ ultimaCopiaEn: copia.exportadaEn });
        avisar('Copia de seguridad guardada');
      }
    } catch (e) {
      avisar(`No se pudo guardar la copia: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const restaurar = async (f: File) => {
    let json: unknown;
    try {
      json = JSON.parse(await f.text());
    } catch {
      return avisar('El archivo no se puede leer. ¿Es una copia de Neto?');
    }
    const r = validarCopia(json);
    if (!r.ok) {
      await confirmar({ titulo: 'No se puede restaurar', mensaje: r.error, confirmar: 'Entendido' });
      return;
    }
    const fecha = r.copia.exportadaEn
      ? new Date(r.copia.exportadaEn).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
      : 'fecha desconocida';
    const ok = await confirmar({
      titulo: 'Restaurar copia',
      mensaje: (
        <>
          Copia del {fecha} con {resumenCopia(r.copia)}.<br />
          <br />
          <strong>Se sustituirán todos los datos actuales.</strong> Si quieres conservarlos, haz antes una copia.
        </>
      ),
      confirmar: 'Restaurar',
      peligro: true,
    });
    if (!ok) return;
    await restaurarCopia(r.copia);
    if (Number.isFinite(Date.parse(r.copia.exportadaEn))) await guardarAjustes({ ultimaCopiaEn: r.copia.exportadaEn });
    avisar('Copia restaurada');
  };

  const borrar = async () => {
    const ok = await confirmar({
      titulo: 'Borrar todos los datos',
      mensaje:
        'Se borrarán tus cuentas, movimientos y ajustes de este ordenador. No se puede deshacer. Si tienes dudas, haz antes una copia de seguridad.',
      confirmar: 'Borrar todo',
      peligro: true,
    });
    if (!ok) return;
    await borrarTodo();
    ir('inicio');
  };

  const ejemplo = async () => {
    const ok = await confirmar({
      titulo: 'Cargar datos de ejemplo',
      mensaje:
        'Se añadirán tres cuentas de ejemplo y seis meses de movimientos inventados, para que veas cómo funciona Neto. Podrás borrarlos después con «Borrar todos los datos».',
      confirmar: 'Cargar ejemplo',
    });
    if (!ok) return;
    await cargarEjemplo();
    avisar('Datos de ejemplo cargados');
    ir('inicio');
  };

  return (
    <>
      <PageHeader titulo="Ajustes" />
      <div className="stack">
        <section className="card">
          <div className="field" style={{ maxWidth: 360 }}>
            <label className="field-label" htmlFor="aj-nombre">
              Tu nombre
            </label>
            <input
              id="aj-nombre"
              className="input"
              value={nombre ?? ajustes.nombre}
              maxLength={40}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={() => {
                if (nombre !== null) {
                  void guardarAjustes({ nombre: nombre.trim() });
                  setNombre(null);
                }
              }}
            />
            <span className="field-hint">Para saludarte en Inicio.</span>
          </div>
        </section>

        <section className="card">
          <div className="setting-row">
            <div className="setting-text">
              <div className="setting-title">Modo autónomo</div>
              <div className="setting-desc">
                Añade el apartado Negocio: facturas, gastos del negocio e impuestos trimestrales, con cuentas separadas
                de las personales.
              </div>
            </div>
            <Switch activo={ajustes.autonomo} onChange={(v) => void cambiarAutonomo(v)} etiqueta="Modo autónomo" />
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Apariencia y colores</h2>
          </div>
          <p className="muted">
            Fondos blancos y selecciones grises, con colores para entender los datos: ingresos en verde, gastos en rojo
            y categorías diferenciadas. Personaliza lo que quieras; cada elección se guarda en este navegador y en tus
            copias de seguridad.
          </p>
          <div className="stack">
            <ColorPicker
              etiqueta="Color de destaque"
              valor={ajustes.colorAcento ?? '#444444'}
              onChange={(colorAcento) => {
                void guardarAjustes({ colorAcento });
              }}
              restablecer={() => {
                void guardarAjustes({ colorAcento: null });
              }}
              textoRestablecer="Sin destaque de color"
            />
            <ColorPicker
              etiqueta="Gráfico de ingresos"
              valor={ajustes.colorIngresos ?? COLORES_UX.ingreso}
              onChange={(colorIngresos) => {
                void guardarAjustes({ colorIngresos });
              }}
              restablecer={() => {
                void guardarAjustes({ colorIngresos: null });
              }}
            />
            <ColorPicker
              etiqueta="Gráfico de gastos"
              valor={ajustes.colorGastos ?? COLORES_UX.gasto}
              onChange={(colorGastos) => {
                void guardarAjustes({ colorGastos });
              }}
              restablecer={() => {
                void guardarAjustes({ colorGastos: null });
              }}
            />
            <ColorPicker
              etiqueta="Gráfico de inversiones"
              valor={ajustes.colorInversiones ?? COLORES_UX.inversion}
              onChange={(colorInversiones) => {
                void guardarAjustes({ colorInversiones });
              }}
              restablecer={() => {
                void guardarAjustes({ colorInversiones: null });
              }}
            />
          </div>
          <p className="field-hint">
            El destaque se aplica a la navegación, tarjetas y controles. Los colores claros se oscurecen en textos y
            trazos para conservar el contraste. Los presupuestos se personalizan al crearlos o editarlos.
          </p>
        </section>
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Categorías</h2>
          </div>
          <div className="grid grid-2" style={{ gap: 32 }}>
            <BloqueCategorias tipo="gasto" categorias={categorias} usos={usos} />
            <BloqueCategorias tipo="ingreso" categorias={categorias} usos={usos} />
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Copia de seguridad</h2>
          </div>
          <p className="muted" style={{ margin: '0 0 18px', maxWidth: 620 }}>
            Tus datos solo están en este ordenador. Guarda una copia de vez en cuando (por ejemplo, en un disco externo
            o en tu nube) para no perderlos si cambias de ordenador.
          </p>
          <p className="backup-last">
            Última copia:{' '}
            {ajustes.ultimaCopiaEn
              ? new Date(ajustes.ultimaCopiaEn).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
              : 'Todavía no has guardado una copia'}
          </p>
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => void exportar()}>
              <Icon name="descargar" size={16} stroke={2} />
              Guardar copia
            </button>
            <button className="btn btn-secondary" onClick={() => archivo.current?.click()}>
              <Icon name="subir" size={16} stroke={2} />
              Restaurar copia
            </button>
            <input
              ref={archivo}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void restaurar(f);
              }}
            />
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Datos</h2>
          </div>
          <div className="stack" style={{ gap: 18 }}>
            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-title">Datos de ejemplo</div>
                <div className="setting-desc">Añade cuentas y movimientos inventados para probar Neto.</div>
              </div>
              <button className="btn btn-secondary" onClick={() => void ejemplo()}>
                Cargar ejemplo
              </button>
            </div>
            <div className="setting-row">
              <div className="setting-text">
                <div className="setting-title">Borrar todos los datos</div>
                <div className="setting-desc">Deja Neto como recién instalada.</div>
              </div>
              <button className="btn btn-danger" onClick={() => void borrar()}>
                Borrar todo
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
