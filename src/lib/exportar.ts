import type { Cuenta, Factura, GastoNegocio } from '../db/types';
import { totalesFactura } from './facturas';
import { categoriaGasto, cifrasGasto, gastoIRPFEnPeriodo } from './gastosNegocio';

/**
 * CSV para abrir en Excel o Numbers en español y pasárselo al gestor: separado por punto y coma,
 * con coma decimal, fechas dd/mm/aaaa y marca UTF-8 para que salgan bien las tildes.
 */
const SEP = ';';
const celda = (v: string | number) => {
  const t = String(v);
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const fila = (valores: (string | number)[]) => valores.map(celda).join(SEP);
/** Céntimos a «1234,56» (sin separador de miles, para que la hoja lo lea como número). */
export const importeCSV = (cents: number) =>
  (cents < 0 ? '-' : '') + (Math.abs(cents) / 100).toFixed(2).replace('.', ',');
export const fechaCSV = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const pctCSV = (n: number) => String(n).replace('.', ',');
const documento = (lineas: string[]) => '﻿' + lineas.join('\r\n') + '\r\n';

/** Libro de facturas emitidas: una línea por cada tipo de IVA de cada factura. */
export function csvFacturas(facturas: readonly Factura[], nifs: Map<string, string>): string {
  const lineas = [
    fila([
      'Número',
      'Fecha',
      'Cliente',
      'NIF',
      'Concepto',
      'Base imponible',
      'Tipo IVA',
      'Cuota IVA',
      'Retención %',
      'Retención',
      'Total factura',
      'Cobrada el',
    ]),
  ];
  for (const f of [...facturas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero))) {
    const t = totalesFactura(f.lineas, f.retencion);
    const concepto = f.lineas
      .map((l) => l.concepto)
      .filter(Boolean)
      .join(' · ');
    t.porTipo.forEach((tipo, i) => {
      const primera = i === 0;
      lineas.push(
        fila([
          f.numero,
          fechaCSV(f.fecha),
          f.clienteNombre,
          (f.clienteId && nifs.get(f.clienteId)) || '',
          concepto,
          importeCSV(tipo.base),
          pctCSV(tipo.tipo),
          importeCSV(tipo.cuota),
          primera ? pctCSV(f.retencion) : '',
          // La retención va sobre la base total: se pone en la primera línea de la factura.
          primera ? importeCSV(t.retencion) : '',
          primera ? importeCSV(t.total) : '',
          primera && f.cobradaEn ? fechaCSV(f.cobradaEn) : '',
        ]),
      );
    });
  }
  return documento(lineas);
}

/** Libro de gastos con lo deducible de cada uno; el gasto en el IRPF es el del periodo exportado. */
export function csvGastos(
  gastos: readonly GastoNegocio[],
  cuentas: Map<string, Pick<Cuenta, 'nombre'>>,
  desde: string,
  hasta: string,
): string {
  const lineas = [
    fila([
      'Fecha',
      'Proveedor',
      'Nº factura',
      'Concepto',
      'Categoría',
      'Base imponible',
      'Tipo IVA',
      'Cuota IVA',
      'Total',
      '% IVA deducible',
      'IVA deducible',
      '% IRPF deducible',
      'Gasto IRPF del periodo',
      'Amortización anual %',
      'Pagado desde',
    ]),
  ];
  for (const g of [...gastos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const c = cifrasGasto(g);
    lineas.push(
      fila([
        fechaCSV(g.fecha),
        g.proveedor,
        g.numero,
        g.concepto,
        categoriaGasto(g.categoria).nombre,
        importeCSV(g.base),
        pctCSV(g.tipoIVA),
        importeCSV(g.cuotaIVA),
        importeCSV(c.total),
        pctCSV(g.deducibleIVA),
        importeCSV(c.ivaDeducible),
        pctCSV(g.deducibleIRPF),
        importeCSV(gastoIRPFEnPeriodo(g, desde, hasta)),
        g.amortizacion ? pctCSV(g.amortizacion) : '',
        (g.cuentaId && cuentas.get(g.cuentaId)?.nombre) || '',
      ]),
    );
  }
  return documento(lineas);
}
