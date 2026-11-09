import { useRef, type ReactNode } from 'react';
import { useAjustes } from '../db/hooks';
import { esEscritorio, esMac } from '../lib/platform';
import { ir, useRuta, type Ruta } from '../router';
import { rutaAlCambiar, type Espacio } from '../lib/espacio';
import { BrandMark, Icon } from '../ui/Icon';

type Seccion = { ruta: Ruta; texto: string };

/** Menú de cada espacio. Personal y Negocio no comparten pantallas (salvo Ajustes). */
const MENU: Record<Espacio, Seccion[]> = {
  personal: [
    { ruta: 'inicio', texto: 'Inicio' },
    { ruta: 'movimientos', texto: 'Movimientos' },
    { ruta: 'presupuestos', texto: 'Presupuestos' },
    { ruta: 'metas', texto: 'Metas' },
    { ruta: 'recurrentes', texto: 'Recurrentes' },
    { ruta: 'inversion', texto: 'Inversión' },
    { ruta: 'cuentas', texto: 'Cuentas' },
  ],
  negocio: [
    { ruta: 'negocio', texto: 'Inicio' },
    { ruta: 'facturas', texto: 'Facturas' },
    { ruta: 'gastos', texto: 'Gastos' },
    { ruta: 'impuestos', texto: 'Impuestos' },
    { ruta: 'negocio-movimientos', texto: 'Movimientos' },
    { ruta: 'suscripciones-negocio', texto: 'Suscripciones' },
    { ruta: 'negocio-cuentas', texto: 'Cuentas' },
  ],
};

/** En el móvil, cuatro accesos fijos abajo; el resto va en «Más». */
const DOCK: Record<Espacio, Seccion[]> = {
  personal: [
    { ruta: 'inicio', texto: 'Inicio' },
    { ruta: 'movimientos', texto: 'Actividad' },
    { ruta: 'cuentas', texto: 'Cuentas' },
    { ruta: 'ajustes', texto: 'Ajustes' },
  ],
  negocio: [
    { ruta: 'negocio', texto: 'Inicio' },
    { ruta: 'facturas', texto: 'Facturas' },
    { ruta: 'negocio-movimientos', texto: 'Actividad' },
    { ruta: 'ajustes', texto: 'Ajustes' },
  ],
};

const activa = (e: Seccion, ruta: Ruta) => ruta === e.ruta || (e.ruta === 'recurrentes' && ruta === 'suscripciones');

/** Selector Personal / Negocio. Cambia de espacio llevando a la pantalla equivalente. */
function SelectorEspacio({ ruta, espacio, compacto = false }: { ruta: Ruta; espacio: Espacio; compacto?: boolean }) {
  const opciones: { valor: Espacio; texto: string }[] = [
    { valor: 'personal', texto: 'Personal' },
    { valor: 'negocio', texto: 'Negocio' },
  ];
  return (
    <div className={`space-switch${compacto ? ' is-compact' : ''}`} role="group" aria-label="Espacio">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={espacio === o.valor}
          onClick={() => espacio !== o.valor && ir(rutaAlCambiar(ruta, o.valor))}
        >
          <Icon name={o.valor} size={compacto ? 15 : 16} />
          <span>{o.texto}</span>
        </button>
      ))}
    </div>
  );
}

function Enlace({ ruta, texto, activa }: { ruta: Ruta; texto: string; activa: boolean }) {
  return (
    <a
      href={`#/${ruta}`}
      className={`nav-link${activa ? ' active' : ''}`}
      aria-current={activa ? 'page' : undefined}
      title={texto}
    >
      <Icon name={ruta} />
      <span>{texto}</span>
    </a>
  );
}

export function Shell({ ruta, espacio, children }: { ruta: Ruta; espacio: Espacio; children: ReactNode }) {
  const ajustes = useAjustes();
  const autonomo = ajustes?.autonomo ?? false;
  const menu = useRef<HTMLDialogElement>(null);
  const dock = DOCK[espacio];
  const resto = MENU[espacio].filter((e) => !dock.some((d) => d.ruta === e.ruta));
  const masActiva = !dock.some((d) => activa(d, ruta));
  return (
    <div className="shell" data-espacio={espacio}>
      <a
        className="skip-link"
        href="#contenido"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('contenido')?.focus();
        }}
      >
        Saltar al contenido
      </a>
      {esEscritorio() && esMac() && <div className="drag-strip" data-tauri-drag-region />}
      <nav className="sidebar" aria-label="Secciones">
        <div className="brand">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>Neto</span>
        </div>
        {autonomo && <SelectorEspacio ruta={ruta} espacio={espacio} />}
        {MENU[espacio].map((e) => (
          <Enlace key={e.ruta} {...e} activa={activa(e, ruta)} />
        ))}
        <div className="sidebar-spacer" />
        <Enlace ruta="ajustes" texto="Ajustes" activa={ruta === 'ajustes'} />
      </nav>
      <main id="contenido" className={`main scene-${ruta}`} key={ruta} tabIndex={-1}>
        <div className="mobile-brand">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>Neto</span>
          {autonomo ? (
            <SelectorEspacio ruta={ruta} espacio={espacio} compacto />
          ) : (
            <span className="mobile-context">Tu dinero, en orden.</span>
          )}
        </div>
        <div className="page">{children}</div>
      </main>
      <nav className="mobile-dock" aria-label="Navegación principal">
        {dock.map((e) => (
          <Enlace key={e.ruta} {...e} activa={activa(e, ruta)} />
        ))}
        <button
          type="button"
          className={`nav-link${masActiva ? ' active' : ''}`}
          aria-haspopup="dialog"
          onClick={() => menu.current?.showModal()}
        >
          <Icon name="otra" />
          <span>Más</span>
        </button>
      </nav>
      <dialog
        ref={menu}
        className="mobile-menu"
        aria-labelledby="menu-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) menu.current?.close();
        }}
      >
        <div className="card-header">
          <h2 id="menu-title" className="card-title">
            {espacio === 'negocio' ? 'Más del negocio' : 'Explora Neto'}
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            aria-label="Cerrar menú"
            onClick={() => menu.current?.close()}
          >
            <Icon name="cerrar" size={18} />
          </button>
        </div>
        <nav
          aria-label="Más secciones"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) menu.current?.close();
          }}
        >
          {resto.map((e) => (
            <Enlace key={e.ruta} {...e} activa={activa(e, ruta)} />
          ))}
        </nav>
      </dialog>
    </div>
  );
}

export function PageHeader({
  titulo,
  subtitulo,
  acciones,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
}) {
  const ruta = useRuta();
  return (
    <header className="page-header">
      <div className="page-heading">
        <span className="scene-identity" aria-hidden="true">
          <Icon name={ruta} size={25} />
        </span>
        <div className="page-heading-copy">
          <h1 className="page-title">{titulo}</h1>
          {subtitulo && <div className="page-subtitle">{subtitulo}</div>}
        </div>
      </div>
      {acciones && <div className="page-actions">{acciones}</div>}
    </header>
  );
}
