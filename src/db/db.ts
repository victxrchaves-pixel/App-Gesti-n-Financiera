import { agruparAhorro } from './savings';
import { neutralizarInicial, colorSemanticoInicial } from '../lib/colors';
import Dexie, { type EntityTable } from 'dexie';
import type {
  Ajustes,
  Categoria,
  Cuenta,
  Movimiento,
  Suscripcion,
  Inversion,
  HistorialCartera,
  Presupuesto,
  Meta,
  AporteMeta,
  PagoFijo,
  PagoRegistrado,
  PlanMes,
} from './types';

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

  metas!: EntityTable<Meta, 'id'>;
  aportesMetas!: EntityTable<AporteMeta, 'id'>;

  planesMes!: EntityTable<PlanMes, 'id'>;
  pagosFijos!: EntityTable<PagoFijo, 'id'>;
  pagosRegistrados!: EntityTable<PagoRegistrado, 'id'>;

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
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('categorias')
          .toCollection()
          .modify((c) => {
            c.color = neutralizarInicial(c);
          });
      });
    this.version(5).stores({ metas: 'id, mesInicio', aportesMetas: 'id, metaId, mes, &[metaId+mes]' });
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('categorias')
          .toCollection()
          .modify((c) => {
            c.color = colorSemanticoInicial(c);
          });
      });
    this.version(7)
      .stores({
        movimientos: 'id, fecha, cuentaId, cuentaDestinoId, categoriaId, tipo, &operacionId',
        pagosFijos: 'id, tipo, proximaFecha',
        pagosRegistrados: 'id, fecha, movimientoId, &[origen+recurrenteId+periodoFecha]',
        aportesMetas: 'id, metaId, mes, grupoId, [metaId+mes]',
      })
      .upgrade(async (tx) => {
        const eliminadas = new Set<string>();
        await tx
          .table('cuentas')
          .toCollection()
          .modify((c) => {
            if (c.archivada) c.eliminada = true;
            c.archivada = false;
            if (c.eliminada) eliminadas.add(c.id);
          });
        await tx
          .table('metas')
          .toCollection()
          .modify((m) => {
            if (eliminadas.has(m.cuentaOrigenId) || eliminadas.has(m.cuentaAhorroId)) m.activa = false;
          });
      });
    this.version(8)
      .stores({})
      .upgrade((tx) => agruparAhorro({ cuentas: tx.table('cuentas'), metas: tx.table('metas') }).then(() => undefined));
    this.version(9).stores({ planesMes: 'id' });
  }
}

export const db = new NetoDB();

/** Tablas incluidas en la copia de seguridad. Añade aquí las nuevas tablas. */
export const TABLAS = [
  'cuentas',
  'movimientos',
  'categorias',
  'ajustes',
  'suscripciones',
  'inversiones',
  'historialCartera',
  'presupuestos',
  'metas',
  'aportesMetas',
  'pagosFijos',
  'pagosRegistrados',
  'planesMes',
] as const;
export type NombreTabla = (typeof TABLAS)[number];
