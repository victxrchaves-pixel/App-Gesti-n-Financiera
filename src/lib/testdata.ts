import type { Cuenta, Movimiento } from '../db/types';

/** Constructores pequeños para los tests. */
let n = 0;

export function cuenta(id: string, saldoInicial = 0, extra: Partial<Cuenta> = {}): Cuenta {
  return { id, nombre: id, tipo: 'banco', ambito: 'personal', saldoInicial, archivada: false, orden: 0, creadaEn: '2026-01-01T00:00:00.000Z', ...extra };
}

export function mov(tipo: Movimiento['tipo'], importe: number, fecha: string, cuentaId: string, extra: Partial<Movimiento> = {}): Movimiento {
  n += 1;
  return {
    id: `m${n}`, tipo, importe, fecha, cuentaId, nota: '', origen: 'manual',
    creadoEn: `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}.000Z`, actualizadoEn: '', ...extra,
  };
}
