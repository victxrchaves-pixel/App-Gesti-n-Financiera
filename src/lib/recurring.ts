import type { Categoria, PagoFijo, Suscripcion } from '../db/types';
export type Ficha = {
  id: string;
  origen: 'fijo' | 'suscripcion';
  nombre: string;
  tipo: 'gasto' | 'ingreso';
  importe: number;
  periodo: Suscripcion['periodo'];
  proximaFecha: string;
  activo: boolean;
  categoria: string;
  categoriaId?: string;
  cuentaId?: string;
  servicioId?: string | null;
};
export function fichasRecurrentes(fijos: PagoFijo[], subs: Suscripcion[], cats: Categoria[]): Ficha[] {
  return [
    ...fijos.map((f) => ({
      ...f,
      origen: 'fijo' as const,
      categoria: cats.find((c) => c.id === f.categoriaId)?.nombre ?? 'Categoría',
    })),
    ...subs
      .filter((s) => s.ambito === 'personal')
      .map((s) => ({ ...s, origen: 'suscripcion' as const, tipo: 'gasto' as const, activo: s.estado === 'activa' })),
  ];
}
export function recurrentesPendientes(fichas: Ficha[], hoy: string) {
  return fichas
    .filter((f) => f.activo && f.proximaFecha <= hoy)
    .sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha) || a.nombre.localeCompare(b.nombre));
}
