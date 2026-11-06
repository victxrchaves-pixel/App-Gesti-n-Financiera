import { Icon } from './Icon';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export function Modal({ titulo, onClose, children, pequeno = false, amplio = false }: { titulo: string; onClose: () => void; children: ReactNode; pequeno?: boolean; amplio?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const primero = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog?.querySelector<HTMLElement>('.modal-body input, .modal-body select, .modal-body button, .modal-footer button');
    primero?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog className={`modal${pequeno ? ' modal-sm' : ''}${amplio ? ' modal-wide' : ''}`} aria-label={titulo} ref={ref}
      onCancel={e => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      onClick={e => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
      }}>
      <div className="modal-heading"><h2 className="modal-title">{titulo}</h2><button type="button" className="btn btn-ghost btn-icon modal-close" aria-label="Cerrar ventana" onClick={onClose}><Icon name="cerrar" size={20}/></button></div>
      {children}
    </dialog>
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
