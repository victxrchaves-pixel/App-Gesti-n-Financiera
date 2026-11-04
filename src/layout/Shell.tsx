import type { ReactNode } from 'react';
import { useAjustes } from '../db/hooks';
import { esEscritorio, esMac } from '../lib/platform';
import { type Ruta } from '../router';
import { BrandMark, Icon } from '../ui/Icon';

const PERSONAL: { ruta: Ruta; texto: string }[] = [
  { ruta: 'inicio', texto: 'Inicio' },
  { ruta: 'movimientos', texto: 'Movimientos' },
  { ruta: 'presupuestos', texto: 'Presupuestos' },
  { ruta: 'metas', texto: 'Metas' },
  { ruta: 'cuentas', texto: 'Cuentas' },
];

const NEGOCIO: { ruta: Ruta; texto: string }[] = [
  { ruta: 'facturas', texto: 'Facturas' },
  { ruta: 'gastos', texto: 'Gastos' },
  { ruta: 'impuestos', texto: 'Impuestos' },
];

function Enlace({ ruta, texto, activa }: { ruta: Ruta; texto: string; activa: boolean }) {
  return (
    <a href={`#/${ruta}`} className={`nav-link${activa ? ' active' : ''}`} aria-current={activa ? 'page' : undefined} title={texto}>
      <Icon name={ruta} />
      <span>{texto}</span>
    </a>
  );
}

export function Shell({ ruta, children }: { ruta: Ruta; children: ReactNode }) {
  const ajustes = useAjustes();
  return (
    <div className="shell">
      {esEscritorio() && esMac() && <div className="drag-strip" data-tauri-drag-region />}
      <nav className="sidebar" aria-label="Secciones">
        <div className="brand">
          <span className="brand-mark"><BrandMark /></span>
          <span>Neto</span>
        </div>
        {PERSONAL.map((e) => <Enlace key={e.ruta} {...e} activa={ruta === e.ruta} />)}
        {ajustes?.autonomo && (
          <>
            <div className="nav-section">Negocio</div>
            <div className="nav-section-rule" />
            {NEGOCIO.map((e) => <Enlace key={e.ruta} {...e} activa={ruta === e.ruta} />)}
          </>
        )}
        <div className="sidebar-spacer" />
        <Enlace ruta="ajustes" texto="Ajustes" activa={ruta === 'ajustes'} />
      </nav>
      <main className="main">
        <div className="page">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ titulo, subtitulo, acciones }: { titulo: string; subtitulo?: ReactNode; acciones?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{titulo}</h1>
        {subtitulo && <div className="page-subtitle">{subtitulo}</div>}
      </div>
      {acciones && <div className="page-actions">{acciones}</div>}
    </header>
  );
}
