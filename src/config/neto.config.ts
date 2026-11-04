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
   * Paleta de categorías: lila y neutros. Las leyendas incluyen siempre nombre e
   * importe para que la información no dependa del color.
   */
  paleta: ['#8860B0', '#363636', '#A080C0', '#595959', '#745095', '#707070', '#9675B6'],
  colorOtros: '#858585',

  /** Colores del gráfico de líneas (ingresos frente a gastos). */
  graficos: { ingresos: '#8860B0', gastos: '#363636' },

  /** Categorías con las que empieza la app. Se pueden editar desde Ajustes. */
  categoriasIniciales: {
    gasto: [
      { nombre: 'Casa', color: '#8860B0' },
      { nombre: 'Comida', color: '#363636' },
      { nombre: 'Transporte', color: '#A080C0' },
      { nombre: 'Ocio', color: '#595959' },
      { nombre: 'Salud', color: '#745095' },
      { nombre: 'Ropa', color: '#707070' },
      { nombre: 'Suscripciones', color: '#9675B6' },
      { nombre: 'Otros', color: '#858585' },
    ],
    ingreso: [
      { nombre: 'Nómina', color: '#8860B0' },
      { nombre: 'Otros ingresos', color: '#A080C0' },
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
    periodosGrafico: [{ valor: '3', texto: '3M' }, { valor: '6', texto: '6M' }, { valor: '12', texto: '1A' }],
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

/** Adapta colores antiguos/importados solo al mostrarlos; conserva los datos guardados. */
export function colorCategoria(color?: string): string {
  if (!color) return config.colorOtros;
  const normalizado = color.toUpperCase();
  const permitidos: readonly string[] = [...config.paleta, config.colorOtros];
  if (permitidos.includes(normalizado)) return normalizado;
  const anteriores = ['#2E7D55', '#D46191', '#2F73C9', '#DB6F36', '#169A8C', '#E3A21E', '#C8433E'];
  const indice = anteriores.indexOf(normalizado);
  return indice >= 0 ? config.paleta[indice] : config.colorOtros;
}
