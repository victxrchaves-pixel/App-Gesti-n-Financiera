import { useEffect, useState } from 'react';
import { esColor } from '../lib/colors';
export function ColorPicker({ etiqueta, valor, onChange, restablecer, textoRestablecer = 'Usar predeterminado' }: { etiqueta: string; valor: string; onChange: (color: string) => void; restablecer?: () => void; textoRestablecer?: string }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return <div className="color-setting"><span>{etiqueta}</span><div className="color-controls"><input type="color" aria-label={etiqueta} value={esColor(valor) ? valor : '#707070'} onChange={e => onChange(e.target.value)} /><input className="input color-hex" aria-label={`Código de ${etiqueta.toLowerCase()}`} value={texto} maxLength={7} onChange={e => { setTexto(e.target.value); if (esColor(e.target.value)) onChange(e.target.value); }} onBlur={() => { if (!esColor(texto)) setTexto(valor); }} spellCheck={false} />{restablecer && <button className="btn btn-ghost btn-sm" type="button" onClick={restablecer}>{textoRestablecer}</button>}</div></div>;
}
