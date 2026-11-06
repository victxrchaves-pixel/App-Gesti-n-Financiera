import { useState } from 'react';
import { centsToInput, parseMoney } from '../lib/money';

/**
 * Campo de importe: guarda el texto mientras se escribe y entrega céntimos (o null si no es válido).
 */
export function useAmountField(inicial?: number) {
  const [texto, setTexto] = useState(inicial === undefined ? '' : centsToInput(inicial));
  return { texto, setTexto, cents: parseMoney(texto) };
}

export function AmountInput({
  texto,
  onChange,
  grande = false,
  autoFocus = false,
  permitirNegativo = false,
  id,
}: {
  texto: string;
  onChange: (t: string) => void;
  grande?: boolean;
  autoFocus?: boolean;
  permitirNegativo?: boolean;
  id?: string;
}) {
  return (
    <div className="input-wrap">
      <input
        id={id}
        className={`input num${grande ? ' input-amount' : ''}`}
        inputMode="decimal"
        placeholder="0,00"
        value={texto}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? true : undefined}
        onChange={(e) => {
          const v = e.target.value;
          const permitido = permitirNegativo ? /^[-−]?[\d.,]*$/ : /^[\d.,]*$/;
          if (permitido.test(v)) onChange(v);
        }}
      />
      <span className="suffix">€</span>
    </div>
  );
}
