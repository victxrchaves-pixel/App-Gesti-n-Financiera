import { addMonths, monthKey, todayISO } from '../lib/dates';
import { db, type NetoDB } from './db';
import { asegurarCategorias, crearCuenta } from './repo';
import { newId } from '../lib/id';
import type { Movimiento } from './types';

/**
 * Datos de ejemplo para probar Neto: tres cuentas y seis meses de movimientos realistas.
 * Se generan siempre igual (sin azar) para que las capturas y pruebas sean repetibles.
 */
export async function cargarEjemplo(d: NetoDB = db, hoy: string = todayISO()): Promise<void> {
  await asegurarCategorias(d);
  const cats = await d.categorias.toArray();
  const cat = (nombre: string) => cats.find((c) => c.nombre === nombre)?.id ?? cats[0].id;

  const banco = await crearCuenta({ nombre: 'Cuenta nómina', tipo: 'banco', ambito: 'personal', saldoInicial: 124000 }, d);
  const ahorro = await crearCuenta({ nombre: 'Ahorro', tipo: 'ahorro', ambito: 'personal', saldoInicial: 520000 }, d);
  const efectivo = await crearCuenta({ nombre: 'Efectivo', tipo: 'efectivo', ambito: 'personal', saldoInicial: 8000 }, d);

  const movs: Movimiento[] = [];
  const t = new Date().toISOString();
  const add = (tipo: Movimiento['tipo'], importe: number, fecha: string, cuentaId: string, categoria?: string, nota = '', destino?: string) => {
    if (fecha > hoy) return;
    movs.push({
      id: newId(), tipo, importe, fecha, cuentaId, nota, origen: 'ejemplo', creadoEn: t, actualizadoEn: t,
      categoriaId: categoria ? cat(categoria) : undefined, cuentaDestinoId: destino,
    });
  };

  const mesActual = monthKey(hoy);
  for (let i = 5; i >= 0; i--) {
    const mes = addMonths(mesActual, -i);
    const dia = (n: number) => `${mes}-${String(n).padStart(2, '0')}`;
    const v = (base: number, k: number) => base + ((i * 7 + k * 13) % 9) * 137; // pequeña variación fija
    add('ingreso', 214000, dia(1), banco, 'Nómina', 'Nómina');
    add('gasto', 85000, dia(2), banco, 'Casa', 'Alquiler');
    add('gasto', v(5400, 1), dia(4), banco, 'Casa', 'Luz');
    add('gasto', 3990, dia(5), banco, 'Casa', 'Internet y móvil');
    add('gasto', 1399, dia(6), banco, 'Suscripciones', 'Netflix');
    add('gasto', 1099, dia(6), banco, 'Suscripciones', 'Spotify');
    add('gasto', 4200, dia(7), banco, 'Salud', 'Gimnasio');
    add('gasto', v(9200, 2), dia(3), banco, 'Comida', 'Mercadona');
    add('gasto', v(7800, 3), dia(10), banco, 'Comida', 'Mercadona');
    add('gasto', v(6500, 4), dia(17), banco, 'Comida', 'Lidl');
    add('gasto', v(8800, 5), dia(24), banco, 'Comida', 'Mercadona');
    add('gasto', 2400, dia(8), efectivo, 'Comida', 'Mercado');
    add('gasto', 5460, dia(9), banco, 'Transporte', 'Abono transporte');
    add('gasto', v(4500, 6), dia(15), banco, 'Transporte', 'Gasolina');
    add('gasto', v(3800, 7), dia(12), banco, 'Ocio', 'Cena con amigos');
    add('gasto', 1800, dia(19), efectivo, 'Ocio', 'Cine');
    add('gasto', v(2200, 8), dia(26), banco, 'Ocio', 'Concierto');
    if (i % 2 === 0) add('gasto', v(6900, 9), dia(14), banco, 'Ropa', 'Zara');
    if (i === 3) add('gasto', 12000, dia(21), banco, 'Salud', 'Dentista');
    if (i === 2) add('ingreso', 18000, dia(20), banco, 'Otros ingresos', 'Venta en Wallapop');
    if (i === 1) add('gasto', 32000, dia(16), banco, 'Ocio', 'Escapada a Lisboa');
    add('transferencia', 30000, dia(2), banco, undefined, 'Ahorro del mes', ahorro);
    add('transferencia', 6000, dia(11), banco, undefined, 'Sacar efectivo', efectivo);
  }
  await d.movimientos.bulkAdd(movs);
}
