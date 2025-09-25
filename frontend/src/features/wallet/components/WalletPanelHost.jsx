import React, { useEffect, useState } from 'react';
import { useAuth, AUTH_STATUS } from '@features/auth/contexts/AuthContext.jsx';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { SidePanel } from '@wallet-adapter/ui/panels/SidePanel';
import WalletMenuContent from '@wallet-adapter/ui/components/WalletMenuContent';
import { panelEvents } from '@wallet-adapter/ui/system/panel-bus';

const isDev =
  typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export default function WalletPanelHost() {
  const { status } = useAuth();
  const isReady = status === AUTH_STATUS.READY;

  const { connected, publicKey } = useWallet();
  const walletConnected = !!publicKey || connected;

  const [open, setOpen] = useState(false);
  const [wantOpen, setWantOpen] = useState(false); // recordatorio de “abre menú” pendiente

  // Escucha del bus
  useEffect(() => {
    const offOpen = panelEvents.onOpen(({ mode }) => {
      if (mode !== 'menu') return; // connect lo gestiona AuthFlowHost
      if (isDev) console.debug('[WalletPanelHost] request open menu');

      if (isReady || walletConnected) {
        setOpen(true);
        setWantOpen(false);
      } else {
        // aún no podemos abrir → lo haremos cuando se cumpla la condición
        setWantOpen(true);
      }
    });

    const offClose = panelEvents.onClose(() => {
      setOpen(false);
      setWantOpen(false);
    });

    return () => {
      offOpen();
      offClose();
    };
  }, [isReady, walletConnected]);

  // Promociona la apertura en cuanto haya condición
  useEffect(() => {
    if (wantOpen && (isReady || walletConnected)) {
      if (isDev) console.debug('[WalletPanelHost] delayed open menu');
      setOpen(true);
      setWantOpen(false);
    }
  }, [wantOpen, isReady, walletConnected]);

  // Si perdemos ambas condiciones, cerramos
  useEffect(() => {
    if (open && !(isReady || walletConnected)) setOpen(false);
  }, [open, isReady, walletConnected]);

  return (
    <SidePanel
      isOpen={open}
      onClose={() => setOpen(false)}
      disableBackdropClose={false} // aquí ya no hay hard‑gate
    >
      <WalletMenuContent onClose={() => setOpen(false)} />
    </SidePanel>
  );
}
