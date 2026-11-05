import { useEffect } from 'react';
import { useCuentas, useMovimientos } from '../db/hooks';
import { sincronizarMetas } from '../db/goals';
import { useToast } from './Modal';
export function SavingsSync() {
  const cuentas=useCuentas();const movimientos=useMovimientos();const avisar=useToast();
  useEffect(()=>{
    let activo=true;
    const actualizar=()=>{void sincronizarMetas().catch(()=>{if(activo)avisar('No se pudieron actualizar las reservas de ahorro. Vuelve a abrir Metas para revisarlas.')})};
    actualizar();const timer=setInterval(actualizar,60000);window.addEventListener('focus',actualizar);
    return()=>{activo=false;clearInterval(timer);window.removeEventListener('focus',actualizar)};
  },[cuentas,movimientos,avisar]);
  return null;
}
