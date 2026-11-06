import { COLORES_UX, COLORES_CATEGORIAS } from '../lib/colors';
/**
 * Configuración de Neto.
 *
 * Todos los porcentajes, plazos, categorías y textos que pueden cambiar viven aquí.
 * El resto del código los lee de este archivo; nunca deben escribirse a fuego.
 */

export const config = {
  moneda: {
    codigo: 'EUR',
    simbolo: '€',
    separadorMiles: '.',
    separadorDecimales: ',',
  },

  /** Saludo según la hora del día (hora local, 0–23). Se usa el último tramo cuyo `desde` sea <= la hora. */
  saludos: [
    { desde: 0, texto: 'Buenas noches' },
    { desde: 6, texto: 'Buenos días' },
    { desde: 14, texto: 'Buenas tardes' },
    { desde: 21, texto: 'Buenas noches' },
  ],

  /**
   * Colores funcionales de categorías. Las leyendas incluyen siempre nombre e
   * importe para que la información no dependa del color.
   */
  paleta: ['#16803C', '#2563B8', '#8B5FBF', '#C07816', '#0F817D', '#BA4E83', '#5D62C2'],
  colorOtros: '#858585',

  /** Colores del gráfico de líneas (ingresos frente a gastos). */
  graficos: { ingresos: COLORES_UX.ingreso, gastos: COLORES_UX.gasto },

  /** Categorías con las que empieza la app. Se pueden editar desde Ajustes. */
  categoriasIniciales: {
    gasto: [
      { nombre: 'Casa', color: COLORES_CATEGORIAS['Casa'] },
      { nombre: 'Comida', color: COLORES_CATEGORIAS['Comida'] },
      { nombre: 'Transporte', color: COLORES_CATEGORIAS['Transporte'] },
      { nombre: 'Ocio', color: COLORES_CATEGORIAS['Ocio'] },
      { nombre: 'Salud', color: COLORES_CATEGORIAS['Salud'] },
      { nombre: 'Ropa', color: COLORES_CATEGORIAS['Ropa'] },
      { nombre: 'Suscripciones', color: COLORES_CATEGORIAS['Suscripciones'] },
      { nombre: 'Otros', color: COLORES_CATEGORIAS['Otros'] },
    ],
    ingreso: [
      { nombre: 'Nómina', color: COLORES_CATEGORIAS['Nómina'] },
      { nombre: 'Otros ingresos', color: COLORES_CATEGORIAS['Otros ingresos'] },
    ],
  },

  /** Nombre de la categoría a la que pasan los movimientos cuando se borra la suya. */
  categoriaPorDefecto: { gasto: 'Otros', ingreso: 'Otros ingresos' },

  tiposCuenta: [
    { id: 'banco', nombre: 'Banco' },
    { id: 'efectivo', nombre: 'Efectivo' },
    { id: 'ahorro', nombre: 'Ahorro' },
    { id: 'otra', nombre: 'Otra' },
  ],

  inicio: {
    /** Periodos disponibles en el gráfico de evolución. */
    periodoInicial: '6',
    periodosGrafico: [
      { valor: '3', texto: '3M' },
      { valor: '6', texto: '6M' },
      { valor: '12', texto: '1A' },
    ],
    /** Movimientos recientes que aparecen en Inicio. */
    ultimosMovimientos: 5,
    /** Categorías que se muestran en la leyenda de la dona antes de agrupar el resto. */
    maxCategoriasDona: 6,
  },

  suscripciones: {
    categorias: ['Entretenimiento', 'Software', 'Asociaciones', 'Formación', 'Salud y deporte', 'Servicios', 'Otros'],
    periodos: [
      { id: 'mensual', nombre: 'Mensual', meses: 1 },
      { id: 'trimestral', nombre: 'Trimestral', meses: 3 },
      { id: 'anual', nombre: 'Anual', meses: 12 },
    ],
    avisoDias: 7,
  },
  inversiones: {
    tipos: [
      { id: 'cripto', nombre: 'Criptomoneda' },
      { id: 'divisa', nombre: 'Divisa' },
      { id: 'accion', nombre: 'Acción' },
      { id: 'fondo', nombre: 'Fondo / ETF' },
      { id: 'otra', nombre: 'Otra inversión' },
    ],
    antiguedadAvisoHoras: 48,
    /**
     * Catálogo público de cotizaciones que GitHub Actions actualiza cada 6 horas en la web.
     * La app de escritorio lo descarga de aquí; si no hay conexión, usa el que lleva dentro
     * el instalador. Si cambias esta dirección, cámbiala también en el CSP de tauri.conf.json.
     */
    cotizacionesUrl: 'https://victxrchaves-pixel.github.io/App-Gesti-n-Financiera/data/quotes.json',
  },

  presupuestos: {
    /** Porcentaje a partir del cual se avisa. */
    avisoPorcentaje: 80,
    /** Meses completos que se usan para sugerir el ingreso mensual del reparto por porcentajes. */
    mesesIngresoSugerido: 3,
    /**
     * Repartos por porcentajes para crear un presupuesto a partir del ingreso mensual.
     * Las claves son los iconos de las categorías (src/lib/iconos.ts), así funcionan aunque
     * la categoría se haya renombrado. Lo que no se reparte queda para ahorrar.
     */
    plantillas: [
      {
        id: 'equilibrado',
        nombre: 'Equilibrado',
        resumen: '50 / 30 / 20',
        descripcion: 'La mitad para lo necesario, un 30 % para tus gustos y un 20 % para ahorrar.',
        reparto: { casa: 30, comida: 12, transporte: 6, salud: 2, ocio: 10, ropa: 5, suscripciones: 5, otros: 10 },
      },
      {
        id: 'ahorrador',
        nombre: 'Ahorrador',
        resumen: '50 / 20 / 30',
        descripcion: 'Lo necesario igual, menos caprichos y un 30 % para ahorrar.',
        reparto: { casa: 30, comida: 12, transporte: 6, salud: 2, ocio: 7, ropa: 3, suscripciones: 3, otros: 7 },
      },
      {
        id: 'holgado',
        nombre: 'Holgado',
        resumen: '60 / 30 / 10',
        descripcion: 'Más margen para el día a día y un 10 % para ahorrar.',
        reparto: { casa: 35, comida: 14, transporte: 8, salud: 3, ocio: 12, ropa: 6, suscripciones: 5, otros: 7 },
      },
    ],
  },

  /** Valores del modo autónomo (se usan a partir de la Fase 4). */
  autonomo: {
    iva: { porDefecto: 21, tipos: [21, 10, 4, 0] },
    irpf: {
      retencion: 15,
      retencionNuevoAutonomo: 7,
      pagoFraccionado: 20,
    },
    diasVencimientoFactura: 30,
    categoriasGasto: ['Software', 'Cuota de autónomos', 'Equipo', 'Coworking', 'Formación', 'Otros'],
    /** Plazos de presentación por trimestre (mes 1–12; el 4T se presenta en enero del año siguiente). */
    plazos: [
      { trimestre: 1, mes: 4, diaInicio: 1, diaFin: 20, anioSiguiente: false },
      { trimestre: 2, mes: 7, diaInicio: 1, diaFin: 20, anioSiguiente: false },
      { trimestre: 3, mes: 10, diaInicio: 1, diaFin: 20, anioSiguiente: false },
      { trimestre: 4, mes: 1, diaInicio: 1, diaFin: 30, anioSiguiente: true },
    ],
    avisoDiasAntes: 7,
    notaImpuestos: 'Cálculo orientativo, confírmalo con tu gestor.',
  },

  copiaSeguridad: {
    /** Versión del formato del archivo de copia. Súbela si cambia la estructura de los datos. */
    version: 10,
    prefijoArchivo: 'neto-copia',
  },
} as const;

export type Config = typeof config;

/** Acepta colores personalizados seguros, sin limitar la paleta del usuario. */
export function colorCategoria(color?: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : config.colorOtros;
}
