import type { Ajustes } from '../db/types';
import { guardarAjustes } from '../db/repo';
import {
  ESTILOS_FONDO,
  NOMBRES_TONOS,
  PALETAS_FONDO,
  estiloFondo,
  mismosTonos,
  muestraCss,
  tonosFondo,
  type TonosFondo,
} from '../lib/fondo';
import { ColorPicker } from './ColorPicker';
import { Segmented } from './Segmented';

/** Tarjeta de Ajustes para elegir el fondo de la app: estilo, paleta y colores propios. */
export function FondoAjustes({ ajustes }: { ajustes: Ajustes }) {
  const estilo = estiloFondo(ajustes);
  const tonos = tonosFondo(ajustes);
  const elegida = PALETAS_FONDO.find((p) => mismosTonos(p.tonos, tonos));
  const cambiarTono = (i: number, color: string) => {
    const nuevos = [...tonos] as TonosFondo;
    nuevos[i] = color;
    void guardarAjustes({ fondoColores: nuevos });
  };

  return (
    <section className="card" aria-labelledby="ajustes-fondo">
      <div className="card-header">
        <h2 className="card-title" id="ajustes-fondo">
          Fondo
        </h2>
      </div>
      <p className="muted">
        El color que se ve detrás de las tarjetas. «Quieto» mantiene el degradado sin movimiento y gasta menos batería;
        «Plano» usa un solo color suave.
      </p>

      <div className="fondo-seccion">
        <span className="field-label">Estilo</span>
        <Segmented
          opciones={ESTILOS_FONDO}
          valor={estilo}
          onChange={(fondoEstilo) => void guardarAjustes({ fondoEstilo })}
          etiqueta="Estilo del fondo"
        />
      </div>

      <div className="fondo-seccion">
        <span className="field-label">Colores</span>
        <ul className="fondo-paletas">
          {PALETAS_FONDO.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="fondo-paleta"
                aria-pressed={elegida?.id === p.id}
                onClick={() => void guardarAjustes({ fondoColores: p.id === PALETAS_FONDO[0].id ? null : p.tonos })}
              >
                <span className="fondo-paleta-muestra" style={{ background: muestraCss(p.tonos) }} aria-hidden="true" />
                {p.nombre}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="fondo-seccion">
        <span className="field-label">{elegida ? 'Personalizar' : 'Tus colores'}</span>
        <div className="stack">
          {NOMBRES_TONOS.map((nombre, i) => (
            <ColorPicker key={nombre} etiqueta={nombre} valor={tonos[i]} onChange={(c) => cambiarTono(i, c)} />
          ))}
        </div>
        {!elegida && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => void guardarAjustes({ fondoColores: null })}
          >
            Volver a los colores por defecto
          </button>
        )}
        <p className="field-hint">Los tonos se aclaran en el fondo para que los textos se lean bien encima.</p>
      </div>
    </section>
  );
}
