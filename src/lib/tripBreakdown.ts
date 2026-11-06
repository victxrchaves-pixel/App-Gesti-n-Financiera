import type { PartidaViaje } from '../db/types';

export function validarDesglose(partidas: unknown, objetivo: number): string | null {
  if (partidas === undefined) return null;
  if (!Array.isArray(partidas) || partidas.length > 50) return 'El desglose admite hasta 50 conceptos.';
  const ids = new Set<string>();
  const nombres = new Set<string>();
  let total = 0;
  for (const p of partidas) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id || ids.has(p.id)) return 'Hay conceptos del viaje sin identificador o duplicados.';
    if (typeof p.nombre !== 'string' || !p.nombre.trim() || p.nombre.length > 60) return 'Pon un nombre de hasta 60 caracteres a cada concepto.';
    const nombre = p.nombre.trim().toLocaleLowerCase('es');
    if (nombres.has(nombre)) return 'Cada concepto debe tener un nombre diferente.';
    if (!Number.isSafeInteger(p.importe) || p.importe < 0) return 'Introduce un importe válido, igual o mayor que cero, en cada concepto.';
    total += p.importe;
    if (!Number.isSafeInteger(total)) return 'La suma del desglose supera el importe permitido.';
    ids.add(p.id); nombres.add(nombre);
  }
  if (total > objetivo) return 'El desglose supera el objetivo del viaje. Reduce los conceptos o aumenta el objetivo de la meta.';
  return null;
}
export function resumenDesglose(partidas: PartidaViaje[], objetivo: number) {
  const asignado = partidas.reduce((s, p) => s + p.importe, 0);
  return { asignado, sinAsignar: objetivo - asignado };
}
