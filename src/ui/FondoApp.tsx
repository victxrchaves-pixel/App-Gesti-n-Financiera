import { useLayoutEffect } from 'react';
import { useAjustes } from '../db/hooks';
import { colorPlano, coloresDegradado, estiloFondo, tonosFondo } from '../lib/fondo';
import { Grainient } from './grainient/Grainient';

/** Fondo de toda la app, detrás de las superficies de cristal. Se elige en Ajustes › Fondo. */
export function FondoApp() {
  const ajustes = useAjustes();
  const estilo = estiloFondo(ajustes);
  const tonos = tonosFondo(ajustes);
  const plano = colorPlano(tonos);

  // El color plano también es el del documento: se ve al estirar la página y si no hay WebGL.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--bg-app', plano);
    document.documentElement.dataset.fondo = estilo;
  }, [plano, estilo]);

  if (!ajustes || estilo === 'plano') return null;
  const quieto = estilo === 'quieto';
  return (
    <div className="app-background" aria-hidden="true">
      <Grainient
        colors={coloresDegradado(tonos)}
        angle={55}
        flow={0.8}
        silk={0.35}
        speed={quieto ? 0 : 0.7}
        grainAmount={0.06}
        grainAnimated={!quieto}
        interactive={!quieto}
        clickSwirl={false}
        dpr={1}
      />
    </div>
  );
}
