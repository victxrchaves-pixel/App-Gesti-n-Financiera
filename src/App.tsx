import { Recurrentes } from './screens/Recurrentes';
import { SavingsSync } from './ui/SavingsSync';
import { RecurringSync } from './ui/RecurringSync';
import { Metas } from './screens/Metas';
import { Theme } from './ui/Theme';
import { useAjustes } from './db/hooks';
import { Shell } from './layout/Shell';
import { esEscritorio, esMac } from './lib/platform';
import { ir, useRuta } from './router';
import { useEffect, useState } from 'react';
import { espacioDeRuta, RUTAS_NEGOCIO, type Espacio } from './lib/espacio';
import { EspacioContext, guardarEspacio, leerEspacioGuardado } from './ui/Espacio';
import { InicioNegocio } from './screens/InicioNegocio';
import { Suscripciones } from './screens/Suscripciones';
import { Inversiones } from './screens/Inversiones';
import { Presupuestos } from './screens/Presupuestos';
import { Ajustes } from './screens/Ajustes';
import { Cuentas } from './screens/Cuentas';
import { Inicio } from './screens/Inicio';
import { Movimientos } from './screens/Movimientos';
import { Onboarding } from './screens/Onboarding';
import { Proximamente } from './screens/Proximamente';
import { Facturas } from './screens/Facturas';
import { ConfirmProvider, ToastProvider } from './ui/Modal';

if (esEscritorio() && esMac()) document.documentElement.classList.add('is-mac');

function Pantalla() {
  const ruta = useRuta();
  const ajustes = useAjustes();
  const [anterior, setAnterior] = useState<Espacio>(leerEspacioGuardado);
  // El espacio guardado al abrir Neto, antes de que la ruta inicial lo cambie.
  const [alAbrir] = useState<Espacio>(leerEspacioGuardado);
  const autonomo = ajustes?.autonomo ?? false;
  const espacio: Espacio = autonomo ? espacioDeRuta(ruta, anterior) : 'personal';

  useEffect(() => {
    if (!ajustes || espacio === anterior) return;
    setAnterior(espacio);
    guardarEspacio(espacio);
  }, [ajustes, espacio, anterior]);

  // Al abrir Neto sin ruta, vuelve al espacio en el que estabas.
  useEffect(() => {
    if (autonomo && !window.location.hash.replace(/^#\/?/, '') && alAbrir === 'negocio') ir('negocio');
  }, [autonomo, alAbrir]);

  if (!ajustes) return null; // cargando la base de datos (milisegundos)
  if (!ajustes.inicioCompletado) {
    return (
      <>
        {esEscritorio() && esMac() && <div className="drag-strip" data-tauri-drag-region />}
        <Onboarding />
      </>
    );
  }
  const efectiva = RUTAS_NEGOCIO.includes(ruta) && !autonomo ? 'inicio' : ruta;
  return (
    <EspacioContext.Provider value={espacio}>
      <Shell ruta={efectiva} espacio={espacio}>
        {efectiva === 'inicio' && <Inicio />}
        {efectiva === 'negocio' && <InicioNegocio />}
        {efectiva === 'movimientos' && <Movimientos />}
        {efectiva === 'negocio-movimientos' && <Movimientos key="negocio" />}
        {efectiva === 'cuentas' && <Cuentas />}
        {efectiva === 'negocio-cuentas' && <Cuentas key="negocio" />}
        {efectiva === 'recurrentes' && <Recurrentes />}
        {efectiva === 'suscripciones' && <Recurrentes soloSuscripciones />}
        {efectiva === 'suscripciones-negocio' && <Suscripciones ambito="negocio" />}
        {efectiva === 'inversion' && <Inversiones />}
        {efectiva === 'metas' && <Metas />}
        {efectiva === 'presupuestos' && <Presupuestos />}
        {efectiva === 'ajustes' && <Ajustes />}
        {efectiva === 'facturas' && <Facturas />}
        {['gastos', 'impuestos'].includes(efectiva) && <Proximamente key={efectiva} seccion={efectiva} />}
      </Shell>
    </EspacioContext.Provider>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Theme />
      <SavingsSync />
      <RecurringSync />
      <ConfirmProvider>
        <Pantalla />
      </ConfirmProvider>
    </ToastProvider>
  );
}
