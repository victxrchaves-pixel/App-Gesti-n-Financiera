import { colorCategoria } from '../config/neto.config';
import { useMapaCategorias } from '../db/hooks';
import { iconoCategoria, reconocerIcono } from '../lib/iconos';
import { CategoryIcon } from './CategoryIcon';

/** Icono de un pago o cobro fijo: por su nombre («Gimnasio» → mancuerna) o por su categoría. */
export function RecurrenteIcon({
  nombre,
  tipo,
  categoriaId,
  size = 42,
}: {
  nombre: string;
  tipo: 'gasto' | 'ingreso';
  categoriaId?: string;
  size?: number;
}) {
  const categorias = useMapaCategorias();
  const cat = categoriaId ? categorias.get(categoriaId) : undefined;
  const icono = reconocerIcono(nombre) ?? (cat ? iconoCategoria(cat) : tipo === 'ingreso' ? 'ingreso-extra' : 'otros');
  return <CategoryIcon icono={icono} color={colorCategoria(cat?.color)} size={size} />;
}
