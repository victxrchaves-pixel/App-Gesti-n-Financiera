import type { CSSProperties } from 'react';
import { COLORES_MARCAS } from '../lib/colors';
import { SERVICIOS, identificarServicio } from '../lib/services';
import { Icon } from './Icon';
const ICONOS = new Set([
  'icloud',
  'youtube',
  'googledrive',
  'figma',
  'claude',
  'netflix',
  'notion',
  'github',
  'spotify',
  'dropbox',
]);
export function ServiceIcon({ id, nombre }: { id?: string | null; nombre: string }) {
  const servicio = SERVICIOS.find((s) => s.id === id) ?? identificarServicio(nombre);
  return (
    <span
      className="service-icon"
      style={{ '--brand-color': servicio ? COLORES_MARCAS[servicio.id] : '#64748B' } as CSSProperties}
      aria-hidden="true"
    >
      {servicio && ICONOS.has(servicio.icono) ? (
        <span
          className="service-logo-mask"
          style={{
            maskImage: `url(${import.meta.env.BASE_URL}icons/services/${servicio.icono}.svg)`,
            WebkitMaskImage: `url(${import.meta.env.BASE_URL}icons/services/${servicio.icono}.svg)`,
          }}
        />
      ) : servicio?.grupo === 'Cloud' ? (
        <Icon name="cloud" size={28} />
      ) : (
        <span>{nombre.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}
