import {
  AppWindow,
  UsersRound,
  CircleAlert,
  TriangleAlert,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Baby,
  Banknote,
  Beer,
  BedDouble,
  Bike,
  Bitcoin,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Bus,
  CalendarDays,
  Car,
  CarTaxiFront,
  ChartPie,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Cloud,
  Coffee,
  Download,
  Droplets,
  Dumbbell,
  Ellipsis,
  FileText,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HandCoins,
  HeartHandshake,
  HeartPulse,
  House,
  IdCard,
  KeyRound,
  Landmark,
  Laptop,
  Luggage,
  Monitor,
  Mountain,
  Music,
  Palette,
  PartyPopper,
  PawPrint,
  Pencil,
  Percent,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  Scissors,
  Settings,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  SprayCan,
  SquareParking,
  Stethoscope,
  Tag,
  Target,
  Ticket,
  TrainFront,
  Trash2,
  TrendingUp,
  Trophy,
  Undo2,
  Upload,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
/** Trazos propios que se usan solo si un nombre no tiene icono de Lucide. */
const paths: Record<string, string> = {
  editar: 'm14 5 5 5M4 20l5-1L21 7l-4-4L5 15z',
  recurrentes: 'M4 8a8 8 0 0 1 13-3l3 3M20 3v5h-5M20 16a8 8 0 0 1-13 3l-3-3M4 21v-5h5',
  check: 'm5 12 4 4 10-10',
  viaje: 'm3 10 7 2 4 8 2-1-1-7 6-7-2-2-7 6-7-1z',
  escudo: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6',
  cloud: 'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13 1 4.5 4.5 0 0 1 0 9z',
  casa: 'M3 11 12 3l9 8M5 9v12h14V9M10 21v-7h4v7',
  comida: 'M5 3v7M9 3v7M5 7h4M7 10v11M17 3v18M17 3c-4 3-4 9 0 9',
  transporte: 'M5 16h14l-2-8H7zM7 8V5h10v3M5 16v4M19 16v4M8 13h1M15 13h1',
  ocio: 'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3h3M20 16a3 3 0 1 1-3-3h3',

  suscripciones: 'M4 7h16v13H4zM4 10h16M8 4v5M16 4v5M9 15h6',
  'suscripciones-negocio': 'M4 7h16v13H4zM4 10h16M8 4v5M16 4v5M9 15h6',
  inversion: 'M4 19V5M4 19h16M7 14l4-4 4 2 5-7M16 5h4v4',
  inicio: 'M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z',
  movimientos: 'M7 4v16m0 0-3.5-3.5M7 20l3.5-3.5M17 20V4m0 0-3.5 3.5M17 4l3.5 3.5',
  presupuestos: 'M12 3a9 9 0 1 0 9 9h-9z M14.5 3.3A9 9 0 0 1 20.7 9.5H14.5z',
  metas: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M12 12.01V12',
  cuentas: 'M3.5 8.5h17v10a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5zM3.5 8.5 6 4.5h12l2.5 4 M16 14h1.5',
  facturas: 'M6.5 3.5h8l3 3v14h-11zM9.5 10.5h5M9.5 14h5M9.5 17.5h3',
  gastos: 'M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5zM9 8.5h6M9 12h6',
  impuestos: 'M5 19 19 5M7.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM16.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  ajustes:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4z',
  calendario: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4',
  mas: 'M12 5v14M5 12h14',
  izquierda: 'm14.5 6-6 6 6 6',
  derecha: 'm9.5 6 6 6-6 6',
  cerrar: 'M6 6l12 12M18 6 6 18',
  flecha: 'M5 12h14m0 0-5-5m5 5-5 5',
  ingreso: 'M12 19V5m0 0-5.5 5.5M12 5l5.5 5.5',
  gasto: 'M12 5v14m0 0-5.5-5.5M12 19l5.5-5.5',
  transferencia: 'M4 8h15m0 0-3.5-3.5M19 8l-3.5 3.5M20 16H5m0 0 3.5-3.5M5 16l3.5 3.5',
  banco: 'M3.5 9.5 12 4.5l8.5 5M5.5 10v7m4.3-7v7m4.4-7v7m4.3-7v7M3.5 20h17',
  efectivo: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v.01M18 14v.01',
  ahorro: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M15.2 8.9a3.9 3.9 0 1 0 0 6.2 M7.8 11h5 M7.8 13.1h5',
  otra: 'M4 12h.01M12 12h.01M20 12h.01',
  descargar: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14',
  subir: 'M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 19.5h14',
  papelera: 'M4.5 7h15M9.5 7V4.5h5V7m-8 0 .8 12.5a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7',
};

/**
 * Iconos de la librería Lucide (licencia ISC) con nombres en castellano. Incluye los de las
 * secciones de la app y los del catálogo de categorías de src/lib/iconos.ts.
 */
const LUCIDE: Record<string, LucideIcon> = {
  // Secciones y acciones
  inicio: House,
  movimientos: ArrowLeftRight,
  presupuestos: ChartPie,
  metas: Target,
  recurrentes: Repeat,
  'suscripciones-negocio': Repeat,
  cuentas: Wallet,
  facturas: FileText,
  clientes: UsersRound,
  cobrar: HandCoins,
  gastos: Receipt,
  ajustes: Settings,
  editar: Pencil,
  check: Check,
  calendario: CalendarDays,
  mas: Plus,
  izquierda: ChevronLeft,
  derecha: ChevronRight,
  cerrar: X,
  flecha: ArrowRight,
  ingreso: ArrowUp,
  gasto: ArrowDown,
  transferencia: ArrowLeftRight,
  descargar: Download,
  subir: Upload,
  papelera: Trash2,
  aviso: TriangleAlert,
  alerta: CircleAlert,
  // Tipos de cuenta y metas
  banco: Landmark,
  efectivo: Banknote,
  otra: Ellipsis,
  viaje: Luggage,
  escudo: ShieldCheck,
  cloud: Cloud,
  // Catálogo de categorías
  casa: House,
  alquiler: KeyRound,
  luz: Zap,
  agua: Droplets,
  gas: Flame,
  internet: Wifi,
  movil: Smartphone,
  muebles: Sofa,
  reparaciones: Hammer,
  limpieza: SprayCan,
  supermercado: ShoppingCart,
  comida: Utensils,
  restaurante: UtensilsCrossed,
  cafe: Coffee,
  bebidas: Beer,
  pizza: Pizza,
  transporte: Bus,
  coche: Car,
  gasolina: Fuel,
  tren: TrainFront,
  taxi: CarTaxiFront,
  parking: SquareParking,
  bici: Bike,
  avion: Plane,
  ocio: Ticket,
  viajes: Luggage,
  hotel: BedDouble,
  cine: Clapperboard,
  musica: Music,
  juegos: Gamepad2,
  libros: BookOpen,
  fiesta: PartyPopper,
  deporte: Trophy,
  gimnasio: Dumbbell,
  montana: Mountain,
  salud: HeartPulse,
  farmacia: Pill,
  medico: Stethoscope,
  belleza: Sparkles,
  peluqueria: Scissors,
  ropa: Shirt,
  compras: ShoppingBag,
  regalos: Gift,
  tecnologia: Laptop,
  mascotas: PawPrint,
  ninos: Baby,
  educacion: GraduationCap,
  donaciones: HeartHandshake,
  suscripciones: RefreshCw,
  seguros: ShieldCheck,
  impuestos: Landmark,
  comisiones: Receipt,
  prestamo: HandCoins,
  ahorro: PiggyBank,
  inversion: TrendingUp,
  cripto: Bitcoin,
  otros: Ellipsis,
  nomina: BriefcaseBusiness,
  freelance: Laptop,
  venta: Tag,
  intereses: Percent,
  devolucion: Undo2,
  'ingreso-extra': HandCoins,
  software: AppWindow,
  equipo: Monitor,
  coworking: Building2,
  cuota: IdCard,
  diseno: Palette,
};

export type IconName = string;

export function Icon({ name, size = 20, stroke = 1.75 }: { name: IconName; size?: number; stroke?: number }) {
  const Dibujo = LUCIDE[name];
  if (Dibujo) return <Dibujo size={size} strokeWidth={stroke} aria-hidden="true" focusable="false" />;
  const d = paths[name] ?? paths.otra;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d.split(/(?=M)/).map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/** Marca de Neto: una N geométrica. */
export function BrandMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 19V5l12 14V5" />
    </svg>
  );
}
