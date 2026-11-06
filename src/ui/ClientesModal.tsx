import { useState } from 'react';
import { actualizarCliente, borrarCliente } from '../db/facturas';
import { useClientes, useFacturas } from '../db/hooks';
import type { Cliente } from '../db/types';
import { contar } from '../lib/plural';
import { Icon } from './Icon';
import { Modal, useConfirm, useToast } from './Modal';

function FilaCliente({ cliente, facturas }: { cliente: Cliente; facturas: number }) {
  const avisar = useToast();
  const confirmar = useConfirm();
  const [nombre, setNombre] = useState(cliente.nombre);
  const [nif, setNif] = useState(cliente.nif);

  const guardar = async () => {
    if (nombre.trim() === cliente.nombre && nif.trim().toUpperCase() === cliente.nif) return;
    try {
      await actualizarCliente(cliente.id, { nombre, nif });
      avisar('Cliente actualizado');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo guardar.');
      setNombre(cliente.nombre);
      setNif(cliente.nif);
    }
  };

  const borrar = async () => {
    const ok = await confirmar({
      titulo: `Borrar «${cliente.nombre}»`,
      mensaje: 'No tiene facturas.',
      confirmar: 'Borrar',
    });
    if (!ok) return;
    await borrarCliente(cliente.id);
    avisar('Cliente borrado');
  };

  return (
    <li className="client-row">
      <input
        className="input"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onBlur={() => void guardar()}
        aria-label="Nombre del cliente"
        maxLength={120}
      />
      <input
        className="input client-nif"
        value={nif}
        onChange={(e) => setNif(e.target.value)}
        onBlur={() => void guardar()}
        aria-label={`NIF de ${cliente.nombre}`}
        placeholder="NIF"
        maxLength={20}
      />
      <span className="faint client-count">{contar(facturas, 'factura', 'facturas')}</span>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        onClick={() => void borrar()}
        disabled={facturas > 0}
        aria-label={`Borrar ${cliente.nombre}`}
        title={facturas > 0 ? 'Tiene facturas: no se puede borrar' : 'Borrar cliente'}
      >
        <Icon name="papelera" size={18} />
      </button>
    </li>
  );
}

export function ClientesModal({ onClose }: { onClose: () => void }) {
  const clientes = useClientes();
  const facturas = useFacturas();
  const usos = new Map<string, number>();
  for (const f of facturas) if (f.clienteId) usos.set(f.clienteId, (usos.get(f.clienteId) ?? 0) + 1);

  return (
    <Modal titulo="Clientes" onClose={onClose}>
      <div className="modal-body">
        {clientes.length === 0 ? (
          <p className="muted">Los clientes se guardan solos al registrar una factura.</p>
        ) : (
          <>
            <p className="field-hint">Cambia el nombre o el NIF y se guarda al salir del campo.</p>
            <ul className="client-list">
              {clientes.map((c) => (
                <FilaCliente key={c.id} cliente={c} facturas={usos.get(c.id) ?? 0} />
              ))}
            </ul>
          </>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Hecho
          </button>
        </div>
      </div>
    </Modal>
  );
}
