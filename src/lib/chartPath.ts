/** Curvas que pasan por los puntos reales sin salirse de los valores vecinos. */
export function curva(puntos: { x: number; y: number }[]) {
  return puntos
    .map((p, i) => {
      if (!i) return `M${p.x},${p.y}`;
      const anterior = puntos[i - 1],
        medio = (anterior.x + p.x) / 2;
      return `C${medio},${anterior.y} ${medio},${p.y} ${p.x},${p.y}`;
    })
    .join(' ');
}
