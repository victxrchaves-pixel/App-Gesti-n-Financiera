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
    /** Periodos del gráfico de mercado de cada inversión. */
    rangos: [
      { id: '1S', dias: 7, texto: 'en la última semana' },
      { id: '1M', dias: 30, texto: 'en el último mes' },
      { id: '3M', dias: 90, texto: 'en los últimos 3 meses' },
      { id: '1A', dias: 365, texto: 'en el último año' },
    ],
    /** Días que muestra la mini gráfica de cada inversión en la lista. */
    diasMiniGrafica: 30,
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

  /** Valores del modo autónomo. Neto registra facturas hechas con otro programa: no las emite. */
  autonomo: {
    /** Tipos de IVA que se pueden elegir en cada línea de una factura. 0 = exenta o no sujeta. */
    iva: { porDefecto: 21, tipos: [21, 10, 4, 0] },
    irpf: {
      /** Retención general de las actividades profesionales. */
      retencion: 15,
      /** Retención reducida de quien empieza: el año de alta y los dos siguientes. */
      retencionNuevoAutonomo: 7,
      aniosRetencionReducida: 2,
      /** Retenciones que se pueden elegir en una factura. */
      tipos: [15, 7, 0],
      /** Pago fraccionado del modelo 130 sobre el rendimiento neto acumulado. */
      pagoFraccionado: 20,
      /** Parte del beneficio que Neto aparta para la renta, ajustable en Ajustes. */
      reservaPorDefecto: 20,
    },
    diasVencimientoFactura: 30,
    /** Categoría de ingreso donde se apuntan los cobros de facturas. Se crea sola la primera vez. */
    categoriaCobros: 'Facturación',
    /** Formato del número sugerido para la primera factura del año: AAAA-001. */
    cifrasNumeroFactura: 3,
    /**
     * Categorías de los gastos del negocio con lo que se suele poder deducir (en %), el IVA habitual
     * de sus facturas y su icono. Son propuestas: cada gasto se puede ajustar a mano.
     * - casa: el porcentaje se multiplica por la parte de la vivienda dedicada a trabajar (metros).
     * - La cuota de autónomos no está aquí: se toma de Ajustes › Tu negocio.
     */
    categoriasGasto: [
      { id: 'software', nombre: 'Software y suscripciones', icono: 'software', iva: 100, irpf: 100, tipoIVA: 21 },
      { id: 'equipo', nombre: 'Equipo e informática', icono: 'equipo', iva: 100, irpf: 100, tipoIVA: 21 },
      { id: 'oficina', nombre: 'Oficina y coworking', icono: 'coworking', iva: 100, irpf: 100, tipoIVA: 21 },
      { id: 'casa', nombre: 'Luz, agua e internet de casa', icono: 'casa', iva: 30, irpf: 30, tipoIVA: 21 },
      { id: 'telefono', nombre: 'Móvil (uso mixto)', icono: 'movil', iva: 50, irpf: 50, tipoIVA: 21 },
      { id: 'vehiculo', nombre: 'Coche y gasolina', icono: 'coche', iva: 50, irpf: 0, tipoIVA: 21 },
      { id: 'dietas', nombre: 'Comidas de trabajo', icono: 'restaurante', iva: 100, irpf: 100, tipoIVA: 10 },
      { id: 'viajes', nombre: 'Viajes de trabajo', icono: 'avion', iva: 100, irpf: 100, tipoIVA: 21 },
      { id: 'formacion', nombre: 'Formación y libros', icono: 'educacion', iva: 100, irpf: 100, tipoIVA: 21 },
      { id: 'asesoria', nombre: 'Gestoría y asesoría', icono: 'impuestos', iva: 100, irpf: 100, tipoIVA: 21 },
      { id: 'publicidad', nombre: 'Publicidad y marketing', icono: 'diseno', iva: 100, irpf: 100, tipoIVA: 21 },
      { id: 'seguros', nombre: 'Seguros del negocio', icono: 'seguros', iva: 0, irpf: 100, tipoIVA: 0 },
      { id: 'bancos', nombre: 'Comisiones del banco', icono: 'comisiones', iva: 0, irpf: 100, tipoIVA: 0 },
      { id: 'otros', nombre: 'Otros gastos del negocio', icono: 'otros', iva: 100, irpf: 100, tipoIVA: 21 },
    ],
    /** Límites diarios de dietas de autónomos (céntimos), pagadas con tarjeta en hostelería. */
    dietas: { espana: 2667, espanaPernoctando: 5334, extranjero: 4808, extranjeroPernoctando: 9135 },
    /** Categoría de gasto donde se apuntan los pagos de gastos del negocio. Se crea sola la primera vez. */
    categoriaPagos: 'Gastos del negocio',
    /** Plazos de presentación por trimestre (mes 1–12; el 4T se presenta en enero del año siguiente). */
    plazos: [
      { trimestre: 1, mes: 4, diaInicio: 1, diaFin: 20, diaDomiciliacion: 15, anioSiguiente: false },
      { trimestre: 2, mes: 7, diaInicio: 1, diaFin: 20, diaDomiciliacion: 15, anioSiguiente: false },
      { trimestre: 3, mes: 10, diaInicio: 1, diaFin: 20, diaDomiciliacion: 15, anioSiguiente: false },
      { trimestre: 4, mes: 1, diaInicio: 1, diaFin: 30, diaDomiciliacion: 25, anioSiguiente: true },
    ],
    /**
     * Festivos nacionales fijos ("MM-DD"). El Viernes Santo se calcula cada año. Los festivos de cada
     * comunidad no se tienen en cuenta: un plazo que caiga en uno de ellos puede durar un día más.
     */
    festivosNacionales: ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'],
    /** Estimación directa simplificada: gastos de difícil justificación sobre el rendimiento neto. */
    dificilJustificacion: { porcentaje: 5, maximoAnual: 200000 },
    /** El modelo 130 no es obligatorio si el año anterior al menos este % de los ingresos llevó retención. */
    exencion130PorRetenciones: 70,
    avisoDiasAntes: 7,
    notaImpuestos: 'Cálculo orientativo, confírmalo con tu gestor.',
  },

  copiaSeguridad: {
    /** Versión del formato del archivo de copia. Súbela si cambia la estructura de los datos. */
    version: 12,
    prefijoArchivo: 'neto-copia',
  },
} as const;

export type Config = typeof config;

/** Acepta colores personalizados seguros, sin limitar la paleta del usuario. */
export function colorCategoria(color?: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : config.colorOtros;
}
