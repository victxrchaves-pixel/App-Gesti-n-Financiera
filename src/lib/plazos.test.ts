import { describe, expect, it } from 'vitest';
import { diasHasta, domingoDePascua, esFestivoNacional, plazoDe, siguienteDiaHabil, siguientePlazo } from './plazos';

describe('plazos de los modelos trimestrales', () => {
  it('fin de semana: pasa al lunes', () => {
    expect(siguienteDiaHabil('2025-07-20')).toBe('2025-07-21'); // domingo → lunes
    expect(siguienteDiaHabil('2027-01-30')).toBe('2027-02-01'); // sábado → lunes
    expect(siguienteDiaHabil('2026-10-20')).toBe('2026-10-20'); // martes, se queda
  });
  it('el próximo plazo según el día de hoy', () => {
    // En noviembre de 2026 toca el 4.º trimestre: del 1 al 30 de enero, que en 2027 cae en sábado.
    expect(siguientePlazo('2026-11-09')).toEqual({
      anio: 2026,
      trimestre: 4,
      inicio: '2027-01-01',
      fin: '2027-02-01',
      domiciliacion: '2027-01-27',
      movido: true,
    });
    expect(siguientePlazo('2026-10-05')).toMatchObject({ anio: 2026, trimestre: 3, fin: '2026-10-20', movido: false });
    // El último día todavía vale.
    expect(siguientePlazo('2026-10-20')).toMatchObject({ trimestre: 3 });
    expect(siguientePlazo('2026-10-21')).toMatchObject({ trimestre: 4 });
    // En enero se presenta el 4.º trimestre del año anterior.
    expect(siguientePlazo('2026-01-10')).toMatchObject({ anio: 2025, trimestre: 4, fin: '2026-01-30' });
  });
  it('días que faltan', () => {
    expect(diasHasta('2026-11-09', '2026-11-09')).toBe(0);
    expect(diasHasta('2026-12-31', '2027-02-01')).toBe(32);
  });
});

describe('festivos', () => {
  it('Pascua y Viernes Santo', () => {
    expect(domingoDePascua(2025)).toBe('2025-04-20');
    expect(domingoDePascua(2026)).toBe('2026-04-05');
    expect(domingoDePascua(2027)).toBe('2027-03-28');
    expect(esFestivoNacional('2025-04-18')).toBe(true); // Viernes Santo
    expect(esFestivoNacional('2026-10-12')).toBe(true);
    expect(esFestivoNacional('2026-10-13')).toBe(false);
  });
  it('un plazo que cae en festivo y luego en fin de semana', () => {
    // 2025: el 20 de abril es domingo de Pascua → lunes 21
    expect(plazoDe(2025, 1)).toMatchObject({ fin: '2025-04-21', domiciliacion: '2025-04-16', movido: true });
    // 2030: el 20 de abril es sábado → lunes 22 (el Viernes Santo es el 19)
    expect(plazoDe(2030, 1).fin).toBe('2030-04-22');
    // 2026: el 20 de abril es lunes, sin cambios; se domicilia hasta el 15
    expect(plazoDe(2026, 1)).toMatchObject({ fin: '2026-04-20', domiciliacion: '2026-04-15', movido: false });
  });
});
