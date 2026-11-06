/** Modelo de datos de Neto. Todos los importes son céntimos enteros. */

export type Ambito = 'personal' | 'negocio';
export type TipoCuenta = 'banco' | 'efectivo' | 'ahorro' | 'otra';

export interface Cuenta {
  /** Los bolsillos internos pertenecen a la única cuenta de ahorro visible. */
  cuentaPadreId?: string;
  bolsilloMetaId?: string;
  ahorroGeneral?: boolean;
  eliminada?: boolean;
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  ambito: Ambito;
  /** Saldo con el que se dio de alta la cuenta (puede ser negativo). */
  saldoInicial: number;
  archivada: boolean;
  orden: number;
  creadaEn: string;
}

export type TipoMovimiento = 'ingreso' | 'gasto' | 'transferencia';

export interface Movimiento {
  /** Un único movimiento bancario repartido entre varias categorías. */
  reparto?: { categoriaId: string; importe: number }[];
  devolucionDe?: string;
  operacionId?: string;
  metaId?: string;
  partidaViajeId?: string;
  id: string;
  tipo: TipoMovimiento;
  /** "AAAA-MM-DD" */
  fecha: string;
  /** Siempre positivo: el signo lo da el tipo. */
  importe: number;
  /** Cuenta de la que sale (gasto, transferencia) o a la que entra (ingreso). */
  cuentaId: string;
  /** Solo en transferencias: cuenta de destino. */
  cuentaDestinoId?: string;
  /** Ingresos y gastos; las transferencias no llevan categoría. */
  categoriaId?: string;
  nota: string;
  origen: 'manual' | 'recurrente' | 'importado' | 'ejemplo' | 'factura';
  /** Cobro de una factura registrada en Negocio. */
  facturaId?: string;
  creadoEn: string;
  actualizadoEn: string;
}

export type TipoCategoria = 'gasto' | 'ingreso';

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  color: string;
  /** Icono elegido en Ajustes (catálogo de src/lib/iconos.ts). Sin él, se deduce del nombre. */
  icono?: string | null;
  orden: number;
}

export interface Ajustes {
  ultimaCopiaEn?: string;
  id: 'ajustes';
  colorAcento?: string | null;
  colorIngresos?: string | null;
  colorGastos?: string | null;
  colorInversiones?: string | null;
  nombre: string;
  autonomo: boolean;
  inicioCompletado: boolean;
  /** Datos fiscales del modo autónomo. Sin ellos se usan los valores por defecto. */
  negocio?: PerfilNegocio;
}

export interface PerfilNegocio {
  /** Las profesionales llevan retención de IRPF en sus facturas; las empresariales, normalmente no. */
  actividad: 'profesional' | 'empresarial';
  /** "AAAA-MM-DD" de alta en Hacienda, o null si no se ha indicado. */
  fechaAlta: string | null;
  nuevoAutonomo: boolean;
  /** devengo: el IVA se declara al emitir la factura. caja: al cobrarla (régimen especial). */
  regimenIVA: 'devengo' | 'caja';
  regimenIRPF: 'simplificada' | 'normal';
  /** Cuota mensual de autónomos, en céntimos. */
  cuotaMensual: number;
  /** Porcentaje del beneficio que se aparta para el IRPF. */
  reservaIRPF: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  /** NIF o CIF, opcional. */
  nif: string;
  creadoEn: string;
}

export interface LineaFactura {
  concepto: string;
  /** Base imponible en céntimos. */
  base: number;
  /** Tipo de IVA en %. */
  tipoIVA: number;
}

/** Factura emitida con otro programa y registrada en Neto. */
export interface Factura {
  id: string;
  numero: string;
  /** "AAAA-MM-DD" de expedición. */
  fecha: string;
  vencimiento: string;
  clienteId: string | null;
  /** Nombre del cliente al registrarla, por si el cliente se borra o cambia de nombre. */
  clienteNombre: string;
  lineas: LineaFactura[];
  /** Retención de IRPF en %. */
  retencion: number;
  nota: string;
  /** "AAAA-MM-DD" del cobro, o null si está pendiente. */
  cobradaEn: string | null;
  /** Ingreso apuntado en una cuenta al cobrarla. */
  movimientoId: string | null;
  creadaEn: string;
  actualizadaEn: string;
}

export interface Suscripcion {
  /** Se apunta sola el día de renovación, con su importe, desde «cuentaId». */
  automatico?: boolean;
  cuentaId?: string | null;
  periodosOmitidos?: string[];
  servicioId?: string | null;
  id: string;
  nombre: string;
  categoria: string;
  ambito: Ambito;
  importe: number;
  periodo: 'mensual' | 'trimestral' | 'anual';
  proximaFecha: string;
  /** Mantiene el día original (p. ej. 31) al pasar por meses más cortos. */
  diaCobro: number;
  estado: 'activa' | 'pausada' | 'cancelada';
  nota: string;
}

export interface Inversion {
  id: string;
  nombre: string;
  tipo: 'cripto' | 'divisa' | 'accion' | 'fondo' | 'otra';
  activoId: string | null;
  /** Unidades decimales; los importes totales sí son céntimos enteros. */
  cantidad: number;
  coste: number;
  /** Precio por unidad en EUR, con precisión para divisas y cripto. */
  precioEUR: number;
  precioFecha: string;
  fuente: string;
  nota: string;
}

export interface HistorialCartera {
  id: string;
  fecha: string;
  total: number;
  coste: number;
  valores: Record<string, number>;
}

/** Límite personal por categoría y mes, en céntimos. */
export interface Presupuesto {
  color?: string | null;
  id: string;
  mes: string;
  categoriaId: string;
  limite: number;
}

export interface PlanMes {
  id: string;
  repetidoDe?: string;
  revisado: boolean;
}

export interface PartidaViaje {
  id: string;
  nombre: string;
  importe: number;
}

export interface Meta {
  desglose?: PartidaViaje[];
  cuentaOrigenId?: string | null;
  cuentaAhorroId?: string | null;
  porcentaje?: number | null;
  baseMensual?: number | null;
  categoriaAhorro?: string;
  pausadaDesde?: string | null;
  id: string;
  nombre: string;
  objetivo: number;
  inicial: number;
  mensual: number;
  mesInicio: string;
  automatica: boolean;
  activa: boolean;
  color?: string | null;
}
export interface AporteMeta {
  grupoId?: string;
  fecha?: string;
  id: string;
  metaId: string;
  mes: string;
  importe: number;
  origen: 'plan' | 'confirmado' | 'transferencia';
  movimientoId?: string;
}

export interface PagoFijo {
  /** Se apunta solo el día que toca, con su importe; se puede corregir luego en Movimientos. */
  automatico?: boolean;
  periodosOmitidos?: string[];
  id: string;
  nombre: string;
  tipo: 'gasto' | 'ingreso';
  importe: number;
  periodo: Suscripcion['periodo'];
  proximaFecha: string;
  diaCobro: number;
  cuentaId: string;
  categoriaId: string;
  activo: boolean;
  nota: string;
}
export interface PagoRegistrado {
  id: string;
  origen: 'fijo' | 'suscripcion';
  recurrenteId: string;
  periodoFecha: string;
  fecha: string;
  importe: number;
  movimientoId: string;
}
