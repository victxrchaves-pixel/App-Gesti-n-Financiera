import { Recurrentes } from './screens/Recurrentes';
import { SavingsSync } from './ui/SavingsSync';
import { RecurringSync } from './ui/RecurringSync';
import { Metas } from './screens/Metas';
import { Theme } from './ui/Theme';
import { useAjustes } from './db/hooks';
import { Shell } from './layout/Shell';
import { esEscritorio, esMac } from './lib/platform';
import { useRuta } from './router';
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
  if (!ajustes) return null; // cargando la base de datos (milisegundos)
  if (!ajustes.inicioCompletado) {
    return (
      <>
        {esEscritorio() && esMac() && <div className="drag-strip" data-tauri-drag-region />}
        <Onboarding />
      </>
    );
  }
  const negocio = ruta === 'facturas' || ruta === 'gastos' || ruta === 'impuestos' || ruta === 'suscripciones-negocio';
  const efectiva = negocio && !ajustes.autonomo ? 'inicio' : ruta;
  return (
    <Shell ruta={efectiva}>
      {efectiva === 'inicio' && <Inicio />}
      {efectiva === 'movimientos' && <Movimientos />}
      {efectiva === 'cuentas' && <Cuentas />}
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
