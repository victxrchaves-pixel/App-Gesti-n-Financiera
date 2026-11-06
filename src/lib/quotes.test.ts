import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config/neto.config';
import { cargarCotizaciones, combinarCatalogos, fuentesCotizaciones, type Cotizacion } from './quotes';

const btc = (precioEUR: number, fecha: string): Cotizacion => ({
  id: 'bitcoin',
  nombre: 'Bitcoin',
  simbolo: 'BTC',
  tipo: 'cripto',
  precioEUR,
  fecha,
  fuente: 'CoinGecko',
});
const usd: Cotizacion = {
  id: 'USD',
  nombre: 'Dólar',
  simbolo: 'USD',
  tipo: 'divisa',
  precioEUR: 0.92,
  fecha: '2026-11-01T10:00:00Z',
  fuente: 'BCE',
};

const REMOTO = config.inversiones.cotizacionesUrl;
const INCLUIDO = '/data/quotes.json';

function servir(respuestas: Record<string, Cotizacion[] | 'sin-red'>) {
  const fetch = vi.fn(async (url: string) => {
    const r = respuestas[url];
    if (!r || r === 'sin-red') throw new TypeError('Failed to fetch');
    return { ok: true, json: async () => ({ activos: r }) } as Response;
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('de dónde salen las cotizaciones', () => {
  it('la web usa su propio catálogo, que se renueva cada 6 horas', () => {
    expect(fuentesCotizaciones(false)).toEqual([INCLUIDO]);
  });
  it('el escritorio pide primero el catálogo publicado y guarda el incluido como respaldo', () => {
    expect(fuentesCotizaciones(true)).toEqual([REMOTO, INCLUIDO]);
  });
});

describe('cargar cotizaciones en el escritorio', () => {
  // El instalador se creó el 1 de noviembre con BTC a 60.000 €; la web tiene el precio del día 6.
  it('con conexión usa el precio publicado más reciente', async () => {
    servir({ [REMOTO]: [btc(71484, '2026-11-06T06:00:00Z')], [INCLUIDO]: [btc(60000, '2026-11-01T06:00:00Z'), usd] });
    const q = await cargarCotizaciones(undefined, fuentesCotizaciones(true));
    expect(q.find((x) => x.id === 'bitcoin')?.precioEUR).toBe(71484);
    expect(q.find((x) => x.id === 'USD')?.precioEUR).toBe(0.92);
  });

  it('sin conexión usa el catálogo incluido en el instalador', async () => {
    servir({ [REMOTO]: 'sin-red', [INCLUIDO]: [btc(60000, '2026-11-01T06:00:00Z')] });
    const q = await cargarCotizaciones(undefined, fuentesCotizaciones(true));
    expect(q).toEqual([btc(60000, '2026-11-01T06:00:00Z')]);
  });

  it('si no hay ninguna fuente, avisa de que se conservan los precios guardados', async () => {
    servir({});
    await expect(cargarCotizaciones(undefined, fuentesCotizaciones(true))).rejects.toThrow(
      'Se conservan los precios guardados',
    );
  });
});

describe('combinar catálogos', () => {
  it('se queda con la cotización más reciente de cada activo', () => {
    const viejo = btc(60000, '2026-11-01T06:00:00Z');
    const nuevo = btc(71484, '2026-11-06T06:00:00Z');
    expect(combinarCatalogos([[viejo, usd], [nuevo]])).toEqual([nuevo, usd]);
    expect(combinarCatalogos([[nuevo], [viejo]])).toEqual([nuevo]);
  });
});
