import { useEffect, useRef, useState } from 'react';

/** Ancho disponible de un contenedor, para que los gráficos se adapten a la ventana. */
export function useWidth<T extends HTMLElement>(inicial = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
