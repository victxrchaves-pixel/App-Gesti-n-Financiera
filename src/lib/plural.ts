/**
 * Cantidad con su palabra en singular o plural: «1 movimiento», «3 movimientos».
 * Las cifras van con el formato español (separador de miles con punto).
 */
export function contar(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString('es-ES')} ${n === 1 ? singular : plural}`;
}
