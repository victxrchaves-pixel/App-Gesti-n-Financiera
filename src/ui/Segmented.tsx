export interface Opcion<T extends string> {
  valor: T;
  texto: string;
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
  return (
    <div className={`segmented${block ? ' block' : ''}`} role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => onChange(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}
