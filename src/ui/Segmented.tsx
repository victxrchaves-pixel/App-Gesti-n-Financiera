import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export interface Opcion<T extends string> {
  valor: T;
  texto: string;
}

/** Posición de la pastilla blanca, medida sobre el botón elegido. */
interface Pastilla {
  x: number;
  top: number;
  w: number;
  h: number;
}

export function Segmented<T extends string>({
  opciones,
  valor,
  onChange,
  block = false,
  etiqueta,
}: {
  opciones: readonly Opcion<T>[];
  valor: T;
  onChange: (v: T) => void;
  block?: boolean;
  etiqueta?: string;
}) {
  const grupo = useRef<HTMLDivElement>(null);
  const [pastilla, setPastilla] = useState<Pastilla | null>(null);
  // La primera colocación no se anima: la pastilla aparece ya en su sitio.
  const [lista, setLista] = useState(false);

  useLayoutEffect(() => {
    const el = grupo.current;
    if (!el) return;
    const medir = () => {
      const b = el.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!b) return setPastilla(null);
      setPastilla({ x: b.offsetLeft, top: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [valor, opciones]);

  useLayoutEffect(() => {
    if (!pastilla || lista) return;
    const id = requestAnimationFrame(() => setLista(true));
    return () => cancelAnimationFrame(id);
  }, [pastilla, lista]);

  return (
    <div
      ref={grupo}
      className={`segmented${block ? ' block' : ''}${pastilla ? ' has-indicator' : ''}`}
      role="group"
      aria-label={etiqueta}
    >
      {pastilla && (
        <span
          className="segmented-indicator"
          aria-hidden="true"
          data-ready={lista}
          style={
            {
              '--seg-x': `${pastilla.x}px`,
              '--seg-top': `${pastilla.top}px`,
              '--seg-w': `${pastilla.w}px`,
              '--seg-h': `${pastilla.h}px`,
            } as CSSProperties
          }
        />
      )}
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => onChange(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}
