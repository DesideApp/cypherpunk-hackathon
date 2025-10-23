import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, AUTH_STATUS } from '@features/auth/contexts/AuthContext.jsx';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { SidePanel } from '@features/wallet/components/SidePanel';
import WalletMenuContent from '@features/wallet/components/WalletMenuContent';
import AuthFlowShell from '@features/auth/ui/system/AuthFlowShell';
import { panelEvents } from '@features/auth/ui/system/panel-bus';
import { useLayout } from '@features/layout/contexts/LayoutContext';

const isDev =
  typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export default function WalletPanelHost() {
  const { status } = useAuth();
  const isReady = status === AUTH_STATUS.READY;

  const { connected, publicKey } = useWallet();
  const walletConnected = !!publicKey || connected;

  const [open, setOpen] = useState(false);
  const [wantOpen, setWantOpen] = useState(false); // recordatorio de “abre menú” pendiente
  const MODE = String(import.meta.env?.VITE_WALLET_PANEL_MODE || 'modal').toLowerCase();
  const { theme } = useLayout(); // fuerza re-render al cambiar tema

  // Safe-area para no tapar la leftbar (usado por el modal)
  const leftInsetPx = useMemo(() => {
    try {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--leftbar-width')
        .trim();
      const n = parseInt(raw || '68', 10);
      return Number.isFinite(n) ? n : 68;
    } catch {
      return 68;
    }
  }, []);

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

  const handleClose = useCallback(() => {
    setOpen(false);
    setWantOpen(false);
    try { panelEvents.close(); } catch {}
  }, []);

  return (
    MODE === 'modal' ? (
      <AuthFlowShell
        key={`wa-shell-${theme}`}
        open={open}
        view={'panel'}
        // Slot gate vacío (no lo usamos en menú)
        gate={<div />}
        // Panel: contenido del menú existente, con su botón de cerrar
        panel={<WalletMenuContent onClose={handleClose} />}
        // Safe-area para no tapar el rail
        leftInsetPx={leftInsetPx}
        onClose={handleClose}
      />
    ) : (
      <SidePanel
        key={`wa-side-${theme}`}
        isOpen={open}
        onClose={handleClose}
        disableBackdropClose={false}
      >
        <WalletMenuContent onClose={handleClose} />
      </SidePanel>
    )
  );
}
