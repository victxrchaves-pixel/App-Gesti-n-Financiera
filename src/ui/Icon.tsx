/** Iconos de trazo fino dibujados a mano (sin emojis ni librerías). */
const paths: Record<string, string> = {
  inicio: 'M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z',
  movimientos: 'M7 4v16m0 0-3.5-3.5M7 20l3.5-3.5M17 20V4m0 0-3.5 3.5M17 4l3.5 3.5',
  presupuestos: 'M12 3a9 9 0 1 0 9 9h-9z M14.5 3.3A9 9 0 0 1 20.7 9.5H14.5z',
  metas: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M12 12.01V12',
  cuentas: 'M3.5 8.5h17v10a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5zM3.5 8.5 6 4.5h12l2.5 4 M16 14h1.5',
  facturas: 'M6.5 3.5h8l3 3v14h-11zM9.5 10.5h5M9.5 14h5M9.5 17.5h3',
  gastos: 'M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5zM9 8.5h6M9 12h6',
  impuestos: 'M5 19 19 5M7.5 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM16.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4z',
  mas: 'M12 5v14M5 12h14',
  izquierda: 'm14.5 6-6 6 6 6',
  derecha: 'm9.5 6 6 6-6 6',
  cerrar: 'M6 6l12 12M18 6 6 18',
  flecha: 'M5 12h14m0 0-5-5m5 5-5 5',
  ingreso: 'M12 19V5m0 0-5.5 5.5M12 5l5.5 5.5',
  gasto: 'M12 5v14m0 0-5.5-5.5M12 19l5.5-5.5',
  transferencia: 'M4 8h15m0 0-3.5-3.5M19 8l-3.5 3.5M20 16H5m0 0 3.5-3.5M5 16l3.5 3.5',
  banco: 'M3.5 9.5 12 4.5l8.5 5M5.5 10v7m4.3-7v7m4.4-7v7m4.3-7v7M3.5 20h17',
  efectivo: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v.01M18 14v.01',
  ahorro: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M15.2 8.9a3.9 3.9 0 1 0 0 6.2 M7.8 11h5 M7.8 13.1h5',
  otra: 'M4 12h.01M12 12h.01M20 12h.01',
  descargar: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14',
  subir: 'M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 19.5h14',
  papelera: 'M4.5 7h15M9.5 7V4.5h5V7m-8 0 .8 12.5a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, stroke = 1.7 }: { name: IconName | string; size?: number; stroke?: number }) {
  const d = paths[name] ?? paths.otra;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split(/(?=M)/).map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/** Marca de Neto: una N geométrica. */
export function BrandMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 19V5l12 14V5" />
    </svg>
  );
}
