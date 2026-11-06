/**
 * Catálogo de iconos de Neto (nombres propios en castellano) y cómo se elige el de cada cosa.
 * Aquí solo hay nombres: el dibujo de cada uno lo pone src/ui/Icon.tsx con la librería Lucide.
 */

export interface GrupoIconos {
  grupo: string;
  iconos: { id: string; etiqueta: string }[];
}

/** Iconos que se pueden elegir para una categoría, agrupados para el selector de Ajustes. */
export const CATALOGO_ICONOS: GrupoIconos[] = [
  {
    grupo: 'Casa',
    iconos: [
      { id: 'casa', etiqueta: 'Casa' },
      { id: 'alquiler', etiqueta: 'Alquiler o hipoteca' },
      { id: 'luz', etiqueta: 'Luz' },
      { id: 'agua', etiqueta: 'Agua' },
      { id: 'gas', etiqueta: 'Gas' },
      { id: 'internet', etiqueta: 'Internet' },
      { id: 'movil', etiqueta: 'Móvil' },
      { id: 'muebles', etiqueta: 'Muebles' },
      { id: 'reparaciones', etiqueta: 'Reparaciones' },
      { id: 'limpieza', etiqueta: 'Limpieza' },
    ],
  },
  {
    grupo: 'Comida',
    iconos: [
      { id: 'supermercado', etiqueta: 'Supermercado' },
      { id: 'comida', etiqueta: 'Comida' },
      { id: 'restaurante', etiqueta: 'Restaurante' },
      { id: 'cafe', etiqueta: 'Café' },
      { id: 'bebidas', etiqueta: 'Bebidas' },
      { id: 'pizza', etiqueta: 'Comida rápida' },
    ],
  },
  {
    grupo: 'Transporte',
    iconos: [
      { id: 'transporte', etiqueta: 'Transporte público' },
      { id: 'coche', etiqueta: 'Coche' },
      { id: 'gasolina', etiqueta: 'Gasolina' },
      { id: 'tren', etiqueta: 'Tren o metro' },
      { id: 'taxi', etiqueta: 'Taxi' },
      { id: 'parking', etiqueta: 'Parking' },
      { id: 'bici', etiqueta: 'Bici' },
      { id: 'avion', etiqueta: 'Avión' },
    ],
  },
  {
    grupo: 'Ocio y viajes',
    iconos: [
      { id: 'ocio', etiqueta: 'Ocio' },
      { id: 'viajes', etiqueta: 'Viajes' },
      { id: 'hotel', etiqueta: 'Alojamiento' },
      { id: 'cine', etiqueta: 'Cine y series' },
      { id: 'musica', etiqueta: 'Música' },
      { id: 'juegos', etiqueta: 'Videojuegos' },
      { id: 'libros', etiqueta: 'Libros' },
      { id: 'fiesta', etiqueta: 'Fiestas' },
      { id: 'deporte', etiqueta: 'Deporte' },
      { id: 'gimnasio', etiqueta: 'Gimnasio' },
      { id: 'montana', etiqueta: 'Naturaleza' },
    ],
  },
  {
    grupo: 'Salud y cuidado',
    iconos: [
      { id: 'salud', etiqueta: 'Salud' },
      { id: 'farmacia', etiqueta: 'Farmacia' },
      { id: 'medico', etiqueta: 'Médico' },
      { id: 'belleza', etiqueta: 'Belleza' },
      { id: 'peluqueria', etiqueta: 'Peluquería' },
    ],
  },
  {
    grupo: 'Compras y personas',
    iconos: [
      { id: 'ropa', etiqueta: 'Ropa' },
      { id: 'compras', etiqueta: 'Compras' },
      { id: 'regalos', etiqueta: 'Regalos' },
      { id: 'tecnologia', etiqueta: 'Tecnología' },
      { id: 'mascotas', etiqueta: 'Mascotas' },
      { id: 'ninos', etiqueta: 'Niños' },
      { id: 'educacion', etiqueta: 'Educación' },
      { id: 'donaciones', etiqueta: 'Donaciones' },
    ],
  },
  {
    grupo: 'Dinero',
    iconos: [
      { id: 'suscripciones', etiqueta: 'Suscripciones' },
      { id: 'seguros', etiqueta: 'Seguros' },
      { id: 'impuestos', etiqueta: 'Impuestos' },
      { id: 'comisiones', etiqueta: 'Comisiones' },
      { id: 'prestamo', etiqueta: 'Préstamos' },
      { id: 'ahorro', etiqueta: 'Ahorro' },
      { id: 'inversion', etiqueta: 'Inversión' },
      { id: 'cripto', etiqueta: 'Cripto' },
      { id: 'otros', etiqueta: 'Otros' },
    ],
  },
  {
    grupo: 'Ingresos y trabajo',
    iconos: [
      { id: 'nomina', etiqueta: 'Nómina' },
      { id: 'freelance', etiqueta: 'Trabajo por cuenta propia' },
      { id: 'venta', etiqueta: 'Ventas' },
      { id: 'intereses', etiqueta: 'Intereses' },
      { id: 'devolucion', etiqueta: 'Devoluciones' },
      { id: 'ingreso-extra', etiqueta: 'Otros ingresos' },
      { id: 'software', etiqueta: 'Software' },
      { id: 'equipo', etiqueta: 'Equipo' },
      { id: 'coworking', etiqueta: 'Oficina' },
      { id: 'cuota', etiqueta: 'Cuota de autónomos' },
      { id: 'diseno', etiqueta: 'Diseño' },
    ],
  },
];

export const ICONOS_VALIDOS = new Set(CATALOGO_ICONOS.flatMap((g) => g.iconos.map((i) => i.id)));

/**
 * Palabras que delatan cada icono, en orden: las reglas más concretas van primero
 * («gasolina» antes que «coche», «otros ingresos» antes que «otros»).
 */
const REGLAS: [RegExp, string][] = [
  [/\b(gimnasio|gym|fitness|crossfit|pilates|yoga|basic ?fit|mancuerna)/, 'gimnasio'],
  [/\b(otros ingresos|ingreso extra|ingresos extra)/, 'ingreso-extra'],
  [/\b(nomina|salario|sueldo|paga extra)/, 'nomina'],
  [/\b(freelance|factura|clientes?|honorarios)/, 'freelance'],
  [/\b(venta|wallapop|vinted|ebay)/, 'venta'],
  [/\b(interes|dividendo|rendimiento)/, 'intereses'],
  [/\b(devolucion|reembolso)/, 'devolucion'],
  [/\b(cuota de autonomos?|seguridad social|reta)\b/, 'cuota'],
  [
    /\b(super|supermercado|mercadona|lidl|carrefour|aldi|alcampo|eroski|consum|hipercor|mercado|compra semanal)/,
    'supermercado',
  ],
  [/\b(restaurante|cena|cenas|comida fuera|tapas|menu del dia|delivery|glovo|just eat|uber eats)/, 'restaurante'],
  [/\b(cafe|cafeteria|starbucks|desayuno)/, 'cafe'],
  [/\b(bebida|cerveza|copas|bar)\b/, 'bebidas'],
  [/\b(pizza|hamburguesa|burger|mcdonald|telepizza)/, 'pizza'],
  [/\b(comida|alimenta|aliment)/, 'comida'],
  [/\b(luz|electricidad|electrica|iberdrola|endesa|naturgy|holaluz)/, 'luz'],
  [/\b(agua)\b/, 'agua'],
  [/\b(gas)\b|butano/, 'gas'],
  [/\b(internet|fibra|wifi)/, 'internet'],
  [/\b(movil|telefono|telefonia)/, 'movil'],
  [/\b(alquiler|hipoteca|comunidad)/, 'alquiler'],
  [/\b(mueble|ikea|decoracion)/, 'muebles'],
  [/\b(reparacion|fontanero|electricista|bricolaje|leroy)/, 'reparaciones'],
  [/\b(limpieza|detergente)/, 'limpieza'],
  [/\b(casa|hogar|vivienda|piso)\b/, 'casa'],
  [/\b(gasolina|combustible|diesel|repsol|cepsa|galp)/, 'gasolina'],
  [/\b(parking|aparcamiento|zona azul|ora)\b/, 'parking'],
  [/\b(taxi|uber|cabify|bolt)\b/, 'taxi'],
  [/\b(tren|renfe|metro|cercanias|ave|ouigo|iryo|abono transporte)/, 'tren'],
  [/\b(bici|bicicleta|patinete)/, 'bici'],
  [/\b(vuelo|vuelos|avion|ryanair|iberia|vueling|aeropuerto)/, 'avion'],
  [/\b(coche|itv|taller|neumatico|peaje)/, 'coche'],
  [/\b(transporte|autobus|bus)\b/, 'transporte'],
  [/\b(hotel|alojamiento|airbnb|booking|hostal)/, 'hotel'],
  [/\b(viaje|viajes|vacaciones|escapada|japon|lisboa|turismo)/, 'viajes'],
  [/\b(cine|pelicula|serie|netflix|hbo|max|disney|prime video|filmin)/, 'cine'],
  [/\b(musica|spotify|concierto|festival)/, 'musica'],
  [/\b(juego|juegos|gaming|playstation|xbox|nintendo|steam)/, 'juegos'],
  [/\b(libro|libros|kindle|libreria)/, 'libros'],
  [/\b(fiesta|cumpleanos|boda|celebracion)/, 'fiesta'],
  [/\b(deporte|futbol|padel|tenis|running|club)/, 'deporte'],
  [/\b(montana|senderismo|camping|naturaleza)/, 'montana'],
  [/\b(ocio|entretenimiento|planes)/, 'ocio'],
  [/\b(farmacia|medicamento|medicina)/, 'farmacia'],
  [/\b(medico|clinica|dentista|fisio|psicolog|hospital|optica)/, 'medico'],
  [/\b(salud|sanidad|bienestar)/, 'salud'],
  [/\b(peluqueria|barberia|corte de pelo)/, 'peluqueria'],
  [/\b(belleza|cosmetica|estetica|maquillaje)/, 'belleza'],
  [/\b(ropa|moda|zara|calzado|zapatos|zapatillas|primark|mango)/, 'ropa'],
  [/\b(regalo|regalos)/, 'regalos'],
  [/\b(mascota|perro|gato|veterinario|pienso)/, 'mascotas'],
  [/\b(nino|ninos|bebe|guarderia|colegio|extraescolar)/, 'ninos'],
  [/\b(educacion|curso|formacion|universidad|academia|master|idiomas)/, 'educacion'],
  [/\b(donacion|ong|caridad)/, 'donaciones'],
  [/\b(suscripcion|suscripciones)/, 'suscripciones'],
  [/\b(seguro|seguros|mutua)/, 'seguros'],
  [/\b(impuesto|impuestos|hacienda|iva|irpf|ibi|tasas)\b/, 'impuestos'],
  [/\b(comision|comisiones|banco)/, 'comisiones'],
  [/\b(prestamo|credito|financiacion|deuda)/, 'prestamo'],
  [/\b(emergencia|colchon|imprevistos)/, 'seguros'],
  [/\b(ahorro|hucha)/, 'ahorro'],
  [/\b(inversion|bolsa|acciones|fondo|etf|broker)/, 'inversion'],
  [/\b(cripto|bitcoin|ethereum)/, 'cripto'],
  [/\b(software|app|apps|licencia|adobe|figma|notion)/, 'software'],
  [/\b(ordenador|portatil|tecnologia|electronica|apple|movil nuevo)/, 'tecnologia'],
  [/\b(equipo|material|camara)/, 'equipo'],
  [/\b(coworking|oficina)/, 'coworking'],
  [/\b(diseno|ilustracion)/, 'diseno'],
  [/\b(compra|compras|amazon|aliexpress|shein)/, 'compras'],
];

export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Icono que mejor encaja con un nombre («Gimnasio» → mancuerna), o null si no lo reconoce. */
export function reconocerIcono(nombre: string): string | null {
  const t = normalizarTexto(nombre);
  for (const [re, id] of REGLAS) if (re.test(t)) return id;
  return null;
}

/** Icono por defecto para un nombre: el reconocido o uno genérico según sea gasto o ingreso. */
export function adivinarIcono(nombre: string, tipo: 'gasto' | 'ingreso' = 'gasto'): string {
  return reconocerIcono(nombre) ?? (tipo === 'ingreso' ? 'ingreso-extra' : 'otros');
}

/** Icono de una categoría: el que eligió la persona o, si no eligió, el que encaja con su nombre. */
export function iconoCategoria(c: { nombre: string; tipo: 'gasto' | 'ingreso'; icono?: string | null }): string {
  return c.icono && ICONOS_VALIDOS.has(c.icono) ? c.icono : adivinarIcono(c.nombre, c.tipo);
}

/** Icono de una meta de ahorro según su nombre y su tipo. */
export function iconoMeta(m: { nombre: string; categoriaAhorro?: string; desglose?: unknown[] }): string {
  const reconocido = reconocerIcono(m.nombre);
  if (reconocido) return reconocido;
  if (m.categoriaAhorro === 'viajes' || (Array.isArray(m.desglose) && m.desglose.length)) return 'viajes';
  return 'ahorro';
}
