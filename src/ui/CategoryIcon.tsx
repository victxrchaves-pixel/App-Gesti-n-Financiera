import type { CSSProperties } from 'react';
import { Icon } from './Icon';

/** Icono de categoría: dibujo del color de la categoría sobre un círculo suave del mismo tono. */
export function CategoryIcon({
  icono,
  color,
  size = 42,
  titulo,
}: {
  icono: string;
  color: string;
  size?: number;
  titulo?: string;
}) {
  return (
    <span
      className="cat-icon"
      style={{ '--cat-color': color, width: size, height: size } as CSSProperties}
      title={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <Icon name={icono} size={Math.round(size * 0.46)} stroke={2} />
    </span>
  );
}
