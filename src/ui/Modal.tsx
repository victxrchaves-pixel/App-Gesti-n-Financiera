import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export function Modal({ titulo, onClose, children, pequeno = false }: { titulo: string; onClose: () => void; children: ReactNode; pequeno?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const primero = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('input, select, button');
    primero?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${pequeno ? ' modal-sm' : ''}`} role="dialog" aria-modal="true" aria-label={titulo} ref={ref}>
        <h2 className="modal-title">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

// ── Confirmación (window.confirm no funciona en la app de escritorio) ───────

interface PeticionConfirmar {
  titulo: string;
  mensaje: ReactNode;
  confirmar: string;
  peligro?: boolean;
}

const ConfirmContext = createContext<(p: PeticionConfirmar) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [peticion, setPeticion] = useState<(PeticionConfirmar & { resolver: (v: boolean) => void }) | null>(null);
  const confirmar = useCallback((p: PeticionConfirmar) => new Promise<boolean>((resolver) => setPeticion({ ...p, resolver })), []);
  const cerrar = (v: boolean) => {
    peticion?.resolver(v);
    setPeticion(null);
  };
  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {peticion && (
        <Modal titulo={peticion.titulo} onClose={() => cerrar(false)} pequeno>
          <div className="muted">{peticion.mensaje}</div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => cerrar(false)}>Cancelar</button>
            <button className={`btn ${peticion.peligro ? 'btn-danger' : 'btn-primary'}`} onClick={() => cerrar(true)} data-autofocus>
              {peticion.confirmar}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

// ── Avisos breves ───────────────────────────────────────────────────────────

const ToastContext = createContext<(texto: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; texto: string }[]>([]);
  const avisar = useCallback((texto: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  return (
    <ToastContext.Provider value={avisar}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.texto}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
