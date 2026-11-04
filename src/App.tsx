import { useAjustes } from './db/hooks';
import { Shell } from './layout/Shell';
import { esEscritorio, esMac } from './lib/platform';
import { useRuta } from './router';
import { Ajustes } from './screens/Ajustes';
import { Cuentas } from './screens/Cuentas';
import { Inicio } from './screens/Inicio';
import { Movimientos } from './screens/Movimientos';
import { Onboarding } from './screens/Onboarding';
import { Proximamente } from './screens/Proximamente';
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
  const negocio = ruta === 'facturas' || ruta === 'gastos' || ruta === 'impuestos';
  const efectiva = negocio && !ajustes.autonomo ? 'inicio' : ruta;
  return (
    <Shell ruta={efectiva}>
      {efectiva === 'inicio' && <Inicio />}
      {efectiva === 'movimientos' && <Movimientos />}
      {efectiva === 'cuentas' && <Cuentas />}
      {efectiva === 'ajustes' && <Ajustes />}
      {['presupuestos', 'metas', 'facturas', 'gastos', 'impuestos'].includes(efectiva) && <Proximamente key={efectiva} seccion={efectiva} />}
    </Shell>
  );
}

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Pantalla />
      </ConfirmProvider>
    </ToastProvider>
  );
}
