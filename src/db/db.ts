import { neutralizarInicial } from '../lib/colors';
import Dexie, { type EntityTable } from 'dexie';
import type { Ajustes, Categoria, Cuenta, Movimiento, Suscripcion, Inversion, HistorialCartera, Presupuesto } from './types';

/** Base de datos local (IndexedDB). Los datos nunca salen del ordenador. */
export class NetoDB extends Dexie {
  cuentas!: EntityTable<Cuenta, 'id'>;
  movimientos!: EntityTable<Movimiento, 'id'>;
  categorias!: EntityTable<Categoria, 'id'>;
  ajustes!: EntityTable<Ajustes, 'id'>;

  suscripciones!: EntityTable<Suscripcion, 'id'>;
  inversiones!: EntityTable<Inversion, 'id'>;
  historialCartera!: EntityTable<HistorialCartera, 'id'>;
  presupuestos!: EntityTable<Presupuesto, 'id'>;

  constructor(nombre = 'neto') {
    super(nombre);
    this.version(1).stores({
      cuentas: 'id, ambito, orden',
      movimientos: 'id, fecha, cuentaId, cuentaDestinoId, categoriaId, tipo',
      categorias: 'id, tipo, orden',
      ajustes: 'id',
    });
    this.version(2).stores({
      suscripciones: 'id, ambito, estado, categoria, proximaFecha',
      inversiones: 'id, tipo, activoId',
      historialCartera: 'id, fecha',
    });
    this.version(3).stores({ presupuestos: 'id, mes, categoriaId, &[mes+categoriaId]' });
    this.version(4).stores({}).upgrade(async tx => {
      await tx.table('categorias').toCollection().modify(c => { c.color = neutralizarInicial(c); });
    });
  }
}

export const db = new NetoDB();

/** Tablas incluidas en la copia de seguridad. Añade aquí las nuevas tablas. */
export const TABLAS = ['cuentas', 'movimientos', 'categorias', 'ajustes', 'suscripciones', 'inversiones', 'historialCartera', 'presupuestos'] as const;
export type NombreTabla = (typeof TABLAS)[number];
