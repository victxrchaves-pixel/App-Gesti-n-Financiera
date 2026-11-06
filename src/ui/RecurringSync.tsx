import { useEffect, useRef } from 'react';
import { useAjustes, useHoy, usePagosFijos, useSuscripciones } from '../db/hooks';
import { registrarAutomaticos } from '../db/recurring';
import { useToast } from './Modal';

/**
 * Apunta solos los recurrentes marcados como automáticos: al abrir Neto, al volver a la
 * ventana, al cambiar de día y cuando se crea o edita una ficha.
 */
export function RecurringSync() {
  const ajustes = useAjustes();
  const hoy = useHoy();
  const fijos = usePagosFijos();
  const subs = useSuscripciones();
  const avisar = useToast();
  const enCurso = useRef(false);
  useEffect(() => {
    if (!ajustes?.inicioCompletado || enCurso.current) return;
    enCurso.current = true;
    void registrarAutomaticos(hoy)
      .then((n) => {
        if (n > 0) avisar(`${n} recurrente${n === 1 ? '' : 's'} apuntado${n === 1 ? '' : 's'} automáticamente`);
      })
      .catch(() => avisar('No se pudieron apuntar los recurrentes automáticos. Revísalos en Recurrentes.'))
      .finally(() => {
        enCurso.current = false;
      });
  }, [ajustes?.inicioCompletado, hoy, fijos, subs, avisar]);
  return null;
}
