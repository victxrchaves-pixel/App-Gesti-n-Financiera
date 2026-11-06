export function Switch({
  activo,
  onChange,
  etiqueta,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onChange(!activo)}
    />
  );
}
