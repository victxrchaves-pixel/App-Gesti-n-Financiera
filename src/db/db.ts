import Dexie, { type EntityTable } from 'dexie';
import type { Ajustes, Categoria, Cuenta, Movimiento } from './types';

/** Base de datos local (IndexedDB). Los datos nunca salen del ordenador. */
export class NetoDB extends Dexie {
  cuentas!: EntityTable<Cuenta, 'id'>;
  movimientos!: EntityTable<Movimiento, 'id'>;
  categorias!: EntityTable<Categoria, 'id'>;
  ajustes!: EntityTable<Ajustes, 'id'>;

  constructor(nombre = 'neto') {
    super(nombre);
    this.version(1).stores({
      cuentas: 'id, ambito, orden',
      movimientos: 'id, fecha, cuentaId, cuentaDestinoId, categoriaId, tipo',
      categorias: 'id, tipo, orden',
      ajustes: 'id',
    });
  }
}

export const db = new NetoDB();

/** Tablas incluidas en la copia de seguridad. Añade aquí las nuevas tablas. */
export const TABLAS = ['cuentas', 'movimientos', 'categorias', 'ajustes'] as const;
export type NombreTabla = (typeof TABLAS)[number];
