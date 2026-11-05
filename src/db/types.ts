/** Modelo de datos de Neto. Todos los importes son céntimos enteros. */

export type Ambito = 'personal' | 'negocio';
export type TipoCuenta = 'banco' | 'efectivo' | 'ahorro' | 'otra';

export interface Cuenta {
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
  origen: 'manual' | 'recurrente' | 'importado' | 'ejemplo';
  creadoEn: string;
  actualizadoEn: string;
}

export type TipoCategoria = 'gasto' | 'ingreso';

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  color: string;
  orden: number;
}

export interface Ajustes {
  id: 'ajustes';
  colorAcento?: string | null;
  colorIngresos?: string | null;
  colorGastos?: string | null;
  colorInversiones?: string | null;
  nombre: string;
  autonomo: boolean;
  inicioCompletado: boolean;
}

export interface Suscripcion {
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
