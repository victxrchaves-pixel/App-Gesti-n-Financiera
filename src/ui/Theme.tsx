import { useLayoutEffect } from 'react';
import { useAjustes } from '../db/hooks';
import { variablesTema } from '../lib/colors';
export function Theme() {
  const ajustes = useAjustes();
  useLayoutEffect(() => {
    for (const [key, value] of Object.entries(variablesTema(ajustes))) document.documentElement.style.setProperty(key, value);
  }, [ajustes]);
  return null;
}
