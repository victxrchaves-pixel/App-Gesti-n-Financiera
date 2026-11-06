import { useEffect } from 'react';
import { useAjustes, useCuentas, useMovimientos } from '../db/hooks';
import { db } from '../db/db';
import { asignarAhorroGeneral } from '../db/savings';
import { asegurarPlanMes } from '../db/budgets';
import { todayISO,monthKey } from '../lib/dates';
import { sincronizarMetas } from '../db/goals';
import { useToast } from './Modal';
export function SavingsSync() {
  const cuentas=useCuentas();const movimientos=useMovimientos();const ajustes=useAjustes();const avisar=useToast();
  useEffect(()=>{
    let activo=true;
    if(!ajustes?.inicioCompletado)return;
    const actualizar=()=>{void (async()=>{await asignarAhorroGeneral(db);await asegurarPlanMes(monthKey(todayISO()));await sincronizarMetas()})().catch(()=>{if(activo)avisar('No se pudieron actualizar el plan y las reservas de ahorro. Vuelve a abrir Presupuestos para revisarlos.')})};
    actualizar();const timer=setInterval(actualizar,60000);window.addEventListener('focus',actualizar);
    return()=>{activo=false;clearInterval(timer);window.removeEventListener('focus',actualizar)};
  },[cuentas,movimientos,ajustes?.inicioCompletado,avisar]);
  return null;
}
