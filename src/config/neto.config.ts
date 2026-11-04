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
   * Paleta de categorías, en orden fijo. Validada para que cada color se distinga del
   * siguiente también con daltonismo. El gris queda reservado para «Otros».
   */
  paleta: ['#2E7D55', '#D46191', '#2F73C9', '#DB6F36', '#169A8C', '#E3A21E', '#C8433E'],
  colorOtros: '#9A9A93',

  /** Colores del gráfico de barras (ingresos frente a gastos). */
  graficos: { ingresos: '#2E7D55', gastos: '#D46191' },

  /** Categorías con las que empieza la app. Se pueden editar desde Ajustes. */
  categoriasIniciales: {
    gasto: [
      { nombre: 'Casa', color: '#2E7D55' },
      { nombre: 'Comida', color: '#D46191' },
      { nombre: 'Transporte', color: '#2F73C9' },
      { nombre: 'Ocio', color: '#DB6F36' },
      { nombre: 'Salud', color: '#169A8C' },
      { nombre: 'Ropa', color: '#E3A21E' },
      { nombre: 'Suscripciones', color: '#C8433E' },
      { nombre: 'Otros', color: '#9A9A93' },
    ],
    ingreso: [
      { nombre: 'Nómina', color: '#2E7D55' },
      { nombre: 'Otros ingresos', color: '#2F73C9' },
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
    /** Meses que muestra el gráfico de barras. */
    mesesHistorico: 6,
    /** Movimientos recientes que aparecen en Inicio. */
    ultimosMovimientos: 5,
    /** Categorías que se muestran en la leyenda de la dona antes de agrupar el resto. */
    maxCategoriasDona: 6,
  },

  presupuestos: {
    /** Porcentaje a partir del cual se avisa. */
    avisoPorcentaje: 80,
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
    version: 1,
    prefijoArchivo: 'neto-copia',
  },
} as const;

export type Config = typeof config;
