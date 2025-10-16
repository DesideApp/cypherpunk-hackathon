// src/wallet-adapter/core/hooks/useWalletGate.ts
import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../contexts/WalletProvider';

/**
 * Controla la apertura automática del gate (modal de conexión) evitando parpadeos:
 * - Espera autoOpenDelayMs antes de decidir (para que el autoconnect arranque).
 * - No abre si hay una conexión efectiva o si está "connecting".
 * Nota: si el host exige firma, puede superponer la condición antes de cerrar.
 */
export function useWalletGate(opts?: { autoOpenDelayMs?: number }) {
  const autoOpenDelayMs = opts?.autoOpenDelayMs ?? 180;

  const { connected, status, publicKey } = useWallet();
  const connecting = status === 'connecting';

  const [bootDone, setBootDone] = useState(false);
  const [open, setOpen] = useState(false);

  // Pequeño grace-period para que el autoconnect haga su trabajo.
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), autoOpenDelayMs);
    return () => clearTimeout(t);
  }, [autoOpenDelayMs]);

  // Decide si abrir/cerrar automáticamente (solo fase pre‑conexión)
  useEffect(() => {
    if (!bootDone) return;
    if (connecting || connected || publicKey) {
      setOpen(false); // ya hay conexión o intento → gate fuera
      return;
    }
    setOpen(true); // no hay nada en curso → gate visible
  }, [bootDone, connecting, connected, publicKey]);

  const shouldShow = useMemo(
    () => bootDone && !connecting && !connected && !publicKey && open,
    [bootDone, connecting, connected, publicKey, open],
  );

  return { open, setOpen, shouldShow, busy: connecting || !bootDone };
}
