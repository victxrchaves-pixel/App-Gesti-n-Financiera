import { describe, expect, it } from 'vitest';
import { adivinarIcono, CATALOGO_ICONOS, iconoCategoria, iconoMeta, ICONOS_VALIDOS } from './iconos';

describe('iconos por nombre', () => {
  it.each([
    ['Gimnasio', 'gimnasio'],
    ['Basic Fit', 'gimnasio'],
    ['Mercadona', 'supermercado'],
    ['Comida', 'comida'],
    ['Cena con amigos', 'restaurante'],
    ['Gasolina', 'gasolina'],
    ['Gas natural', 'gas'],
    ['Luz', 'luz'],
    ['Internet y móvil', 'internet'],
    ['Alquiler', 'alquiler'],
    ['Casa', 'casa'],
    ['Transporte', 'transporte'],
    ['Abono transporte', 'tren'],
    ['Viajes', 'viajes'],
    ['Escapada a Lisboa', 'viajes'],
    ['Ocio', 'ocio'],
    ['Netflix', 'cine'],
    ['Salud', 'salud'],
    ['Dentista', 'medico'],
    ['Ropa', 'ropa'],
    ['Suscripciones', 'suscripciones'],
    ['Nómina', 'nomina'],
    ['Otros ingresos', 'ingreso-extra'],
    ['Venta en Wallapop', 'venta'],
    ['Fondo de emergencia', 'seguros'],
    ['Cuota de autónomos', 'cuota'],
  ])('«%s» → %s', (nombre, icono) => {
    expect(adivinarIcono(nombre)).toBe(icono);
  });

  it('lo que no reconoce usa un icono genérico de gasto o de ingreso', () => {
    expect(adivinarIcono('Cosas varias')).toBe('otros');
    expect(adivinarIcono('Otros')).toBe('otros');
    expect(adivinarIcono('Bizum de mamá', 'ingreso')).toBe('ingreso-extra');
  });

  it('todos los iconos que puede devolver existen en el catálogo', () => {
    for (const n of ['Gimnasio', 'Mercadona', 'Viajes', 'Netflix', 'Nómina', 'xyz'])
      expect(ICONOS_VALIDOS.has(adivinarIcono(n))).toBe(true);
    expect(CATALOGO_ICONOS.flatMap((g) => g.iconos).length).toBe(ICONOS_VALIDOS.size);
  });

  it('el icono elegido en Ajustes manda sobre el adivinado', () => {
    expect(iconoCategoria({ nombre: 'Ocio', tipo: 'gasto', icono: 'musica' })).toBe('musica');
    expect(iconoCategoria({ nombre: 'Ocio', tipo: 'gasto' })).toBe('ocio');
    expect(iconoCategoria({ nombre: 'Ocio', tipo: 'gasto', icono: 'no-existe' })).toBe('ocio');
  });

  it('las metas toman el icono de su nombre o de su tipo', () => {
    expect(iconoMeta({ nombre: 'Japón 2027' })).toBe('viajes');
    expect(iconoMeta({ nombre: 'Coche nuevo' })).toBe('coche');
    expect(iconoMeta({ nombre: 'Algo', categoriaAhorro: 'viajes' })).toBe('viajes');
    expect(iconoMeta({ nombre: 'Ahorro general' })).toBe('ahorro');
  });
});
