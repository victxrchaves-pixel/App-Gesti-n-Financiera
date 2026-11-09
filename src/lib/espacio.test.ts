import { describe, expect, it } from 'vitest';
import { espacioDeRuta, rutaAlCambiar } from './espacio';

describe('espacios Personal y Negocio', () => {
  it('cada ruta pertenece a un espacio; Ajustes se queda en el que estabas', () => {
    expect(espacioDeRuta('inicio', 'negocio')).toBe('personal');
    expect(espacioDeRuta('facturas', 'personal')).toBe('negocio');
    expect(espacioDeRuta('negocio-cuentas', 'personal')).toBe('negocio');
    expect(espacioDeRuta('ajustes', 'negocio')).toBe('negocio');
    expect(espacioDeRuta('ajustes', 'personal')).toBe('personal');
  });
  it('al cambiar de espacio va a la pantalla equivalente o al inicio', () => {
    expect(rutaAlCambiar('movimientos', 'negocio')).toBe('negocio-movimientos');
    expect(rutaAlCambiar('negocio-cuentas', 'personal')).toBe('cuentas');
    expect(rutaAlCambiar('presupuestos', 'negocio')).toBe('negocio');
    expect(rutaAlCambiar('facturas', 'personal')).toBe('inicio');
    expect(rutaAlCambiar('ajustes', 'negocio')).toBe('ajustes');
  });
});
