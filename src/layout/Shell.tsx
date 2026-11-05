import { useRef, type ReactNode } from 'react';
import { useAjustes } from '../db/hooks';
import { esEscritorio, esMac } from '../lib/platform';
import { type Ruta } from '../router';
import { BrandMark, Icon } from '../ui/Icon';

const PERSONAL: { ruta: Ruta; texto: string }[] = [
  { ruta: 'inicio', texto: 'Inicio' },
  { ruta: 'movimientos', texto: 'Movimientos' },
  { ruta: 'presupuestos', texto: 'Presupuestos' },
  { ruta: 'metas', texto: 'Metas' },
  { ruta: 'suscripciones', texto: 'Suscripciones' },
  { ruta: 'inversion', texto: 'Inversión' },
  { ruta: 'cuentas', texto: 'Cuentas' },
];

const NEGOCIO: { ruta: Ruta; texto: string }[] = [
  { ruta: 'suscripciones-negocio', texto: 'Suscripciones' },
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
  const menu = useRef<HTMLDialogElement>(null);
  const masActiva = !['inicio', 'movimientos', 'cuentas', 'ajustes'].includes(ruta);
  return (
    <div className="shell">
      {esEscritorio() && esMac() && <div className="drag-strip" data-tauri-drag-region />}
      <nav className="sidebar" aria-label="Secciones">
        <div className="brand">
          <span className="brand-mark"><BrandMark /></span>
          <span>Neto</span>
        </div>
        <div className="nav-section">Personal</div>
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
      <main className={`main scene-${ruta}`} key={ruta}>
        <div className="mobile-brand"><span className="brand-mark"><BrandMark /></span><span>Neto</span><span className="mobile-context">Tu dinero, en orden.</span></div>
        <div className="page"><div className="scene-identity" aria-hidden="true"><Icon name={ruta} size={36}/></div>{children}</div>
      </main>
      <nav className="mobile-dock" aria-label="Navegación principal">
        <Enlace ruta="inicio" texto="Inicio" activa={ruta === 'inicio'} />
        <Enlace ruta="movimientos" texto="Movimientos" activa={ruta === 'movimientos'} />
        <Enlace ruta="cuentas" texto="Cuentas" activa={ruta === 'cuentas'} />
        <Enlace ruta="ajustes" texto="Ajustes" activa={ruta === 'ajustes'} />
        <button type="button" className={`nav-link${masActiva ? ' active' : ''}`} aria-haspopup="dialog" onClick={() => menu.current?.showModal()}><Icon name="otra" /><span>Más</span></button>
      </nav>
      <dialog ref={menu} className="mobile-menu" aria-labelledby="menu-title" onClick={e => { if (e.target === e.currentTarget) menu.current?.close(); }}>
        <div className="card-header"><h2 id="menu-title" className="card-title">Explora Neto</h2><button type="button" className="btn btn-secondary btn-icon" aria-label="Cerrar menú" onClick={() => menu.current?.close()}><Icon name="cerrar" size={18} /></button></div>
        <nav aria-label="Más secciones" onClick={e => { if ((e.target as HTMLElement).closest('a')) menu.current?.close(); }}>
          <Enlace ruta="suscripciones" texto="Suscripciones" activa={ruta === 'suscripciones'} />
          <Enlace ruta="inversion" texto="Inversión" activa={ruta === 'inversion'} />
          <Enlace ruta="presupuestos" texto="Presupuestos" activa={ruta === 'presupuestos'} />
          <Enlace ruta="metas" texto="Metas" activa={ruta === 'metas'} />
          {ajustes?.autonomo && <><div className="nav-section">Negocio</div>{NEGOCIO.map(e => <Enlace key={e.ruta} {...e} activa={ruta === e.ruta} />)}</>}
        </nav>
      </dialog>
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
