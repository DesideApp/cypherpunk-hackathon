import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { useAuth, AUTH_STATUS } from '@features/auth/contexts/AuthContext.jsx';
import { panelEvents } from '@features/auth/ui/system/panel-bus';

// Shell puro (overlay + cross-fade + card auto-tamaño)
import AuthFlowShell from '@features/auth/ui/system/AuthFlowShell';
// Contenidos reales (DISEÑO intacto)
import AuthGateModal from '@features/auth/ui/components/AuthGateModal';
import WalletModalContent from '@features/auth/ui/components/WalletModalContent';

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

// mismas claves que WalletProvider (evitamos imports cruzados)
const KEY_LAST_WALLET = 'wa:lastWallet';
const KEY_LAST_CONNECTED_WALLET = 'wa:lastConnectedWallet';

export default function AuthFlowHost() {
  const { connected, publicKey, status: walletStatus } = useWallet();
  const { status: authStatus } = useAuth();

  const connecting      = walletStatus === 'connecting';
  const authBusy        = authStatus === AUTH_STATUS.AUTHENTICATING;
  const authReady       = authStatus === AUTH_STATUS.READY;
  const walletConnected = !!publicKey || connected;

  // ===== refs con los últimos valores (para callbacks async) =====
  const connectingRef      = useRef(connecting);
  const authBusyRef        = useRef(authBusy);
  const walletConnectedRef = useRef(walletConnected);
  useEffect(() => {
    connectingRef.current = connecting;
    authBusyRef.current = authBusy;
    walletConnectedRef.current = walletConnected;
  }, [connecting, authBusy, walletConnected]);

  // Grace pequeño para el boot
  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setBootDone(true), 180);
    return () => window.clearTimeout(t);
  }, []);

  // ¿Existe persistencia al entrar? (decide auto‑gate)
  const hasPersistedRef = useRef(false);
  useEffect(() => {
    try {
      hasPersistedRef.current = Boolean(
        localStorage.getItem(KEY_LAST_WALLET) ||
        localStorage.getItem(KEY_LAST_CONNECTED_WALLET)
      );
    } catch {
      hasPersistedRef.current = false;
    }
  }, []);

  // Apertura manual por bus (usuario lo pide)
  const [manualConnect, setManualConnect] = useState(false);
  // Recordamos si el usuario inició el intento, para el “reopen on locked/error”
  const userInitiatedRef = useRef(false);

  useEffect(() => {
    const offOpen = panelEvents.onOpen(({ mode }) => {
      if (mode === 'menu') {
        // El menú lo gestiona WalletPanelHost
        setManualConnect(false);
        return;
      }
      // Si piden 'connect' pero YA hay wallet, redirigimos a menú.
      if (walletConnectedRef.current) {
        if (isDev) console.debug('[AuthFlowHost] connect requested but walletConnected → route to menu');
        userInitiatedRef.current = false;
        setManualConnect(false);
        panelEvents.open('menu');
        return;
      }
      if (isDev) console.debug('[AuthFlowHost] open(connect) via bus');
      userInitiatedRef.current = true;
      setManualConnect(true);
    });

    const offClose = panelEvents.onClose(() => {
      if (isDev) console.debug('[AuthFlowHost] close(shell) via bus');
      userInitiatedRef.current = false;
      setManualConnect(false);
    });

    return () => { offOpen(); offClose(); };
  }, []);

  // Cerrar Shell en cuanto hay popup/firma activa
  useEffect(() => {
    if (connecting || authBusy) {
      if (isDev) console.debug('[AuthFlowHost] hide shell: provider/auth busy');
      setManualConnect(false);
    }
  }, [connecting, authBusy]);

  // Si Auth termina (READY o ERROR) → Shell fuera
  useEffect(() => {
    if (authStatus === AUTH_STATUS.READY || authStatus === AUTH_STATUS.ERROR) {
      if (isDev) console.debug('[AuthFlowHost] auth finished → close shell', authStatus);
      userInitiatedRef.current = false;
      setManualConnect(false);
    }
  }, [authStatus]);

  // Reabrir SOLO si la apertura fue iniciada por el usuario y falló (locked/error)
  useEffect(() => {
    if ((walletStatus === 'locked' || walletStatus === 'error') && userInitiatedRef.current) {
      if (isDev) console.debug('[AuthFlowHost] reopen for retry (locked/error & user-initiated)');
      setManualConnect(true);
    }
  }, [walletStatus]);

  // --- Sesión expirada → abrir gate sólo cuando corresponde (con espera de autoconnect) ---
  const expiredGuardRef = useRef(0);
  const reopenTimeoutRef = useRef(null);

  useEffect(() => {
    const onSessionExpired = () => {
      const now = Date.now();
      // Anti-rebote (múltiples disparos en < 1000ms)
      if (now - expiredGuardRef.current < 1000) {
        if (isDev) console.debug('[AuthFlowHost] sessionExpired throttled');
        return;
      }
      expiredGuardRef.current = now;

      if (isDev) console.debug('[AuthFlowHost] sessionExpired → maybe open connect gate');

      // No interferir si ya estamos listos u ocupados con popup/firma
      if (authStatus === AUTH_STATUS.READY || connectingRef.current || authBusyRef.current) return;

      // Si ya hay wallet conectada, no abrimos el gate (el re‑login vendrá por ensureReady())
      if (walletConnectedRef.current) return;

      // Si hay persistencia (última wallet recordada), esperamos al autoconnect.
      if (hasPersistedRef.current) {
        if (isDev) console.debug('[AuthFlowHost] persisted wallet present → wait for autoconnect');

        // Limpia timeout previo si lo hubiera
        if (reopenTimeoutRef.current != null) {
          window.clearTimeout(reopenTimeoutRef.current);
          reopenTimeoutRef.current = null;
        }
        // Fallback: si en ~1200ms seguimos sin señales, abrimos gate entonces.
        reopenTimeoutRef.current = window.setTimeout(() => {
          const stillIdle =
            !walletConnectedRef.current &&
            !connectingRef.current &&
            !authBusyRef.current;
          if (stillIdle) {
            if (isDev) console.debug('[AuthFlowHost] autoconnect did not start → open gate fallback');
            userInitiatedRef.current = true;
            setManualConnect(true);
            panelEvents.open('connect');
          }
        }, 1200);

        return;
      }

      // Sin persistencia → abrimos gate inmediatamente
      userInitiatedRef.current = true;
      setManualConnect(true);
      panelEvents.open('connect');
    };

    window.addEventListener('sessionExpired', onSessionExpired);
    return () => {
      window.removeEventListener('sessionExpired', onSessionExpired);
      if (reopenTimeoutRef.current != null) {
        window.clearTimeout(reopenTimeoutRef.current);
        reopenTimeoutRef.current = null;
      }
    };
  }, [authStatus]);

  // Reglas de apertura del Shell
  //  - Nunca si READY
  //  - Nunca si connecting / AUTHENTICATING
  //  - Abierto si manualConnect **y NO** estamos ya conectados
  //  - Auto‑Gate sólo en boot sin wallet y sin persistencia
  const open = useMemo(() => {
    if (authReady) return false;
    if (connecting || authBusy) return false;
    if (manualConnect && !walletConnected) return true;   // defensa extra
    if (!bootDone) return false;
    if (walletConnected) return false;
    if (hasPersistedRef.current) return false; // evita flash cuando hay autoconnect
    return true; // frío total: sin persistencia ni wallet
  }, [authReady, connecting, authBusy, manualConnect, bootDone, walletConnected]);

  const view = manualConnect ? 'panel' : 'gate';

  // Slots reales, en modo inShell
  const gateSlot = (
    <AuthGateModal
      inShell
      onRequestConnect={() => {
        if (isDev) console.debug('[AuthFlowHost] gate → request connect');
        userInitiatedRef.current = true;
        setManualConnect(true);
        panelEvents.open('connect');
      }}
    />
  );

  const panelSlot = (
    <WalletModalContent
      inShell
      onConnected={() => {
        // Al conectar desde el modal: cerramos Shell y NO abrimos menú automáticamente.
        if (isDev) console.debug('[AuthFlowHost] wallet connected (closing shell only)');
        userInitiatedRef.current = false;
        setManualConnect(false);
      }}
    />
  );

  // Safe-area de la leftbar
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

  if (isDev && open) {
    console.debug('[AuthFlowHost] render', {
      open, view, authReady, authBusy, walletConnected,
      manualConnect, connecting, bootDone, hasPersisted: hasPersistedRef.current,
    });
  }

  return (
    <AuthFlowShell
      open={open && bootDone}
      view={view}
      gate={gateSlot}
      panel={panelSlot}
      leftInsetPx={leftInsetPx}
    />
  );
}
