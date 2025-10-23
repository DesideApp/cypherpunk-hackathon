// src/components/layout/LeftBar.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, User as UserIcon, ArrowLeftRight, Settings, BarChart3 } from 'lucide-react';
import { useLayout } from '@features/layout/contexts/LayoutContext';
import { panelEvents } from '@wallet-adapter/ui/system/panel-bus';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { useRpc } from '@wallet-adapter/core/contexts/RpcProvider';
import { PublicKey } from '@solana/web3.js';
import { useAuth, AUTH_STATUS } from '@features/auth/contexts/AuthContext.jsx';
import { useAuthManager } from '@features/auth/hooks/useAuthManager.js';
import ThemeToggle from '@features/layout/components/ThemeToggle.jsx';
import SettingsPanel from '@features/settings/components/SettingsPanel.jsx';
import './LeftBar.css';
import bs58 from 'bs58';

const ICON_SIZE = 20;
const STROKE = 2;
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
const swapEnabled = String(import.meta.env?.VITE_FEATURE_SWAP ?? 'false').toLowerCase() === 'true';

const PASSTHROUGH_SHAPES = {
  CONTEXT: 'context',
  WRAPPED_CONTEXT: 'wrapped-context',
  NONE: 'none',
};

const LeftBarLogo = () => {
  const { theme } = useLayout();
  const logoSrc = theme === 'dark' ? '/assets/logo-dark.svg' : '/assets/logo-light.svg';
  return <img src={logoSrc} alt="Logo" className="leftbar-logo-icon" />;
};

export default function LeftBar() {
  const { isMobile, leftbarExpanded, setLeftbarExpanded, theme } = useLayout();
  const [activeModal, setActiveModal] = useState(null); // null = Chat (página), 'swap'/'user'/'settings' = Modal activo
  const closeDrawerIfMobile = useCallback(() => {
    if (isMobile) {
      setLeftbarExpanded(false);
    }
  }, [isMobile, setLeftbarExpanded]);
  
  // Función para cerrar TODOS los modales antes de abrir uno nuevo
  const closeAllModals = useCallback(() => {
    // Cerrar Jupiter si está abierto
    try {
      if (window.Jupiter?.close) {
        if (isDev) console.debug('[LeftBar] Cerrando Jupiter...');
        window.Jupiter.close();
      }
    } catch (e) {
      if (isDev) console.debug('[LeftBar] Error cerrando Jupiter:', e);
    }
    
    // Cerrar WalletPanel (User) usando el bus de eventos
    try {
      panelEvents.close();
      if (isDev) console.debug('[LeftBar] WalletPanel cerrado via panelEvents');
    } catch (e) {
      if (isDev) console.debug('[LeftBar] Error cerrando WalletPanel:', e);
    }
    
    // Settings se cierra automáticamente via activeModal state
  }, []);
  
  // Función para volver a Chat (cerrar modal activo)
  const returnToChat = useCallback(() => {
    if (isDev) console.debug('[LeftBar] Volviendo a Chat (sin modal)');
    closeDrawerIfMobile();
    closeAllModals();
    setActiveModal(null); // null = Chat está activo
  }, [closeAllModals, closeDrawerIfMobile]);
  
  // ESC para cerrar modal activo y volver a Chat
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && activeModal) {
        if (isDev) console.debug('[LeftBar] ESC → Cerrando modal, volviendo a Chat');
        returnToChat();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activeModal, returnToChat]);

  // Detectar cuando WalletPanel (User) se cierra manualmente
  useEffect(() => {
    if (activeModal !== 'user') return;

    // Escuchar el evento de cierre del panel
    const handlePanelClose = () => {
      if (isDev) console.debug('[LeftBar] WalletPanel cerrado → Volviendo a Chat');
      setActiveModal(null);
    };

    const unsubscribe = panelEvents.onClose(handlePanelClose);
    return () => unsubscribe();
  }, [activeModal]);
  const {
    adapter,
    status: walletStatus,
    connected,
    publicKey,
    connect,
    disconnect,
    availableWallets,
  } = useWallet();
  const { endpoint, connection } = useRpc();
  // Jupiter endpoint aislado del core: usa sus propias env vars (no rompe RTC/WS)
  const J_MODE_RAW = (import.meta.env?.VITE_JUPITER_MODE || 'mainnet');
  const J_MODE = String(J_MODE_RAW).toLowerCase();
  const J_RPC_MAIN = import.meta.env?.VITE_JUPITER_RPC_MAINNET;
  const J_RPC_DEV = import.meta.env?.VITE_JUPITER_RPC_DEVNET;
  const jupiterEndpoint =
    (J_MODE === 'mainnet' || J_MODE === 'mainnet-beta')
      ? (J_RPC_MAIN || endpoint)
      : (J_RPC_DEV || endpoint);
  const { status: authStatus } = useAuth();
  const isReady = authStatus === AUTH_STATUS.READY;
  const walletConnected = Boolean(publicKey);

  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuthManager();

  const isDrawerOpen = isMobile && leftbarExpanded;

  // ===== Jupiter Plugin integration =====
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const pluginBootstrappedRef = useRef(false);
  const passthroughShapeRef = useRef(PASSTHROUGH_SHAPES.NONE);

  const REFERRAL_ACCOUNT = "6kiaNP1ep5yb64mtTkJGwSH5Lgv4rn9vJo9rbQQj8Ppb";
  const REFERRAL_FEE_BPS = 80;

  const getBranding = (t) => {
    const base = t === 'dark' ? '/assets/logo-dark.svg' : '/assets/logo-light.svg';
    return { logoUri: `${base}?v=${t}`, name: 'Deside Swap' };
  };

  function buildJupiterWalletPassthrough(adapter, status, connectionRef) {
    if (!adapter) return null;

    const statusConnecting = status === 'connecting';
    const statusConnected = status === 'connected' || !!adapter.publicKey;

    let publicKeyObj = null;
    const publicKeyString = adapter.publicKey || null;
    try {
      if (publicKeyString) publicKeyObj = new PublicKey(publicKeyString);
    } catch {
      publicKeyObj = null;
    }

    const asUint8Array = (value) =>
      typeof value === 'string' ? bs58.decode(value) : value;

    const signMessageFn =
      typeof adapter.signMessage === 'function'
        ? async (msg) => {
            const asString = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
            const signature = await adapter.signMessage(asString);
            return asUint8Array(signature);
          }
        : undefined;

    const signTransactionFn = adapter.signTransaction?.bind(adapter);
    const signAllTransactionsFn = adapter.signAllTransactions?.bind(adapter);

    const sendTransactionFn =
      typeof adapter.signTransaction === 'function'
        ? async (tx, maybeConnection, options) => {
            const conn = maybeConnection && typeof maybeConnection.sendRawTransaction === 'function'
              ? maybeConnection
              : connectionRef;
            if (!conn || typeof conn.sendRawTransaction !== 'function') {
              throw new Error('Connection unavailable for sendTransaction');
            }
            const signedTx = await adapter.signTransaction(tx);
            const serialized = typeof signedTx?.serialize === 'function' ? signedTx.serialize() : signedTx;
            return conn.sendRawTransaction(serialized, options);
          }
        : undefined;

    const connectFn = async () => {
      try {
        await adapter.connect?.();
      } catch {
        if (availableWallets?.length) {
          try { await connect(availableWallets[0]); } catch {}
        }
      }
    };

    const disconnectFn = async () => {
      try { await adapter.disconnect?.(); } catch {}
      try { await disconnect?.(); } catch {}
    };

    const walletRecord = adapter
      ? {
          adapter,
          name: adapter.name,
          icon: adapter.icon,
          publicKey: publicKeyObj || publicKeyString,
          readyState: 'Installed',
        }
      : null;

    return {
      autoConnect: false,
      wallets: walletRecord ? [walletRecord] : [],
      wallet: walletRecord,
      publicKey: publicKeyObj || publicKeyString,
      connecting: statusConnecting,
      connected: statusConnected,
      disconnecting: false,
      select: () => {},
      connect: connectFn,
      disconnect: disconnectFn,
      sendTransaction: sendTransactionFn,
      signTransaction: signTransactionFn,
      signAllTransactions: signAllTransactionsFn,
      signMessage: signMessageFn,
    };
  }

  // Intenta inicializar el plugin con distintas formas de passthrough.
  // Algunas builds esperan { wallet }, otras el objeto directo.
  // Devuelve la forma aceptada o 'none' si desactivamos passthrough.
  function initJupiterRobust({ branding, endpoint, walletPassthrough, onConnectRequest }) {
    const base = {
      displayMode: 'modal',
      formProps: {
        referralAccount: REFERRAL_ACCOUNT,
        referralFee: REFERRAL_FEE_BPS,
      },
      endpoint,
      onRequestConnectWallet: onConnectRequest,
      branding,
    };

    const attempts = [];
    if (walletPassthrough) {
      attempts.push({
        shape: PASSTHROUGH_SHAPES.CONTEXT,
        props: { ...base, enableWalletPassthrough: true, passthroughWalletContextState: walletPassthrough },
      });
      attempts.push({
        shape: PASSTHROUGH_SHAPES.WRAPPED_CONTEXT,
        props: { ...base, enableWalletPassthrough: true, passthroughWalletContextState: { wallet: walletPassthrough } },
      });
    }
    // Último recurso: sin passthrough (deja que el plugin gestione conexión)
    attempts.push({ shape: PASSTHROUGH_SHAPES.NONE, props: { ...base, enableWalletPassthrough: false } });

    for (const a of attempts) {
      try {
        window.Jupiter.init(a.props);
        passthroughShapeRef.current = a.shape;
        return a.shape;
      } catch (_) {
        try { window.Jupiter.close?.(); } catch {}
        try { window.Jupiter.destroy?.(); } catch {}
      }
    }
    passthroughShapeRef.current = PASSTHROUGH_SHAPES.NONE;
    return PASSTHROUGH_SHAPES.NONE;
  }

  const ensurePluginLoaded = async () => {
    if (scriptLoaded && typeof window !== 'undefined' && window.Jupiter) return true;
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://plugin.jup.ag/plugin-v1.js';
      s.async = true;
      s.onload = () => { setScriptLoaded(true); resolve(true); };
      document.body.appendChild(s);
    });
  };

  useEffect(() => {
    if (!scriptLoaded || !window.Jupiter) return;
    const branding = getBranding(theme);
    if (typeof window.Jupiter.setBranding === 'function') {
      try { window.Jupiter.setBranding(branding); return; } catch {}
    }
    if (typeof window.Jupiter.setProps === 'function') {
      try { window.Jupiter.setProps({ branding }); return; } catch {}
    }
    if (pluginBootstrappedRef.current) {
      const wasOpen =
        (typeof window.Jupiter.isOpen === 'function' && window.Jupiter.isOpen()) ||
        !!document.querySelector('[data-jupiter-modal="open"], jupiter-terminal');

      if (wasOpen) {
        window.Jupiter.close?.();
        requestAnimationFrame(() => {
          initJupiterRobust({
            branding,
            endpoint: jupiterEndpoint,
            walletPassthrough: buildJupiterWalletPassthrough(adapter, walletStatus, connection),
            onConnectRequest: () => {
              try { panelEvents.open('connect'); } catch {}
              if (availableWallets?.[0]) connect(availableWallets[0]);
            },
          });
          (window.Jupiter.resume?.() || window.Jupiter.open?.());
        });
      } else {
        pluginBootstrappedRef.current = false;
      }
    }
  }, [theme, scriptLoaded, endpoint, adapter, walletStatus, connection, connect, availableWallets]);

  useEffect(() => {
    if (!scriptLoaded || !window.Jupiter || !pluginBootstrappedRef.current) return;
    const walletPassthrough = buildJupiterWalletPassthrough(adapter, walletStatus, connection);
    const enablePass = !!walletPassthrough;
    if (typeof window.Jupiter.setProps === 'function') {
      try {
        const props = { endpoint: jupiterEndpoint };
        if (enablePass) {
          const shape = passthroughShapeRef.current;
          if (shape === PASSTHROUGH_SHAPES.NONE) {
            Object.assign(props, { enableWalletPassthrough: false });
          } else {
            const passthroughValue = shape === PASSTHROUGH_SHAPES.WRAPPED_CONTEXT
              ? { wallet: walletPassthrough }
              : walletPassthrough;
            Object.assign(props, {
              enableWalletPassthrough: true,
              passthroughWalletContextState: passthroughValue,
            });
          }
        } else {
          Object.assign(props, { enableWalletPassthrough: false });
        }
        window.Jupiter.setProps(props);
        return;
      } catch {}
    }
    pluginBootstrappedRef.current = false;
  }, [adapter, walletStatus, endpoint, connection, scriptLoaded, jupiterEndpoint]);


  const openJupiterSwap = async () => {
    if (!swapEnabled) return;
    closeDrawerIfMobile();
    
    // Cerrar otros modales antes de abrir Jupiter
    closeAllModals();
    
    // Pequeño delay para asegurar cierre
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setActiveModal('swap'); // Marcar como activo
    
    if (!walletConnected) {
      try { panelEvents.open('connect'); } catch {}
      if (availableWallets?.[0]) connect(availableWallets[0]);
      return;
    }
    await ensurePluginLoaded();
    if (!window.Jupiter) return;
    const openSafely = () => (window.Jupiter.resume?.() || window.Jupiter.open?.());
    if (!pluginBootstrappedRef.current) {
      const walletContextState = buildJupiterWalletPassthrough(adapter, walletStatus, connection);
      const _shape = initJupiterRobust({
        branding: getBranding(theme),
        endpoint: jupiterEndpoint,
        walletPassthrough: walletContextState,
        onConnectRequest: () => {
          try { panelEvents.open('connect'); } catch {}
          if (availableWallets?.[0]) connect(availableWallets[0]);
        },
      });
      pluginBootstrappedRef.current = true;
      try {
        openSafely();
      } catch (_) {
        // Fallback: reintentar sin passthrough si la build no soporta la forma usada
        try { window.Jupiter.close?.(); } catch {}
        try { window.Jupiter.destroy?.(); } catch {}
        passthroughShapeRef.current = PASSTHROUGH_SHAPES.NONE;
        initJupiterRobust({
          branding: getBranding(theme),
          endpoint,
          walletPassthrough: null,
          onConnectRequest: () => {
            try { panelEvents.open('connect'); } catch {}
            if (availableWallets?.[0]) connect(availableWallets[0]);
          },
        });
        openSafely();
      }
      return;
    }
    try { openSafely(); } catch {}
  };

  const pages = [
    { path: '/', icon: <MessageCircle size={ICON_SIZE} strokeWidth={STROKE} />, label: 'Chat' },
    ...(swapEnabled
      ? [
          {
            action: () => openJupiterSwap(),
            icon: <ArrowLeftRight size={ICON_SIZE} strokeWidth={STROKE} />,
            label: 'Swap',
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            path: '/admin/stats',
            navigatePath: '/admin/stats/dashboard',
            icon: <BarChart3 size={ICON_SIZE} strokeWidth={STROKE} />,
            label: 'Stats',
          },
        ]
      : []),
  ];

  const isActive = (path) => {
    if (!path) return false;
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className={`leftbar ${isDrawerOpen ? 'expanded' : ''}`}>
      <div className="leftbar-inner">
        {/* Logo decorativo */}
        <div className="leftbar-logo" aria-hidden="true">
          <LeftBarLogo />
        </div>

        {/* Nav superior */}
        <div className="leftbar-section top-section">
          {pages.map((link) => {
            const active = link.path ? isActive(link.path) && !activeModal : false;
            const isSwapModal = link.label === 'Swap';
            return (
              <button
                key={link.path || link.label}
                type="button"
                className={`leftbar-button ${active ? 'active' : ''}`}
                data-modal-open={isSwapModal && activeModal === 'swap' ? 'true' : undefined}
                aria-label={link.label}
                aria-current={active ? 'page' : undefined}
                title={link.label}
                onClick={(e) => {
                  e.stopPropagation();
                  if (link.action) {
                    link.action();
                    if (isDev) console.debug('[LeftBar] Action', link.label);
                    closeDrawerIfMobile();
                  } else if (link.path) {
                    // Cerrar todos los modales y volver a Chat
                    returnToChat();
                    const target = link.navigatePath || link.path;
                    navigate(target);
                    if (isDev) console.debug('[LeftBar] Navigate', target);
                  }
                }}
              >
                <span className="icon-container">{link.icon}</span>
              </button>
            );
          })}
        </div>

        <div className="leftbar-free" />

        {/* Zona inferior */}
        <div className="leftbar-section bottom-section">
          {/* Account / Wallet - PRIMERO */}
          <button
            type="button"
            className="leftbar-button user-button"
            data-modal-open={activeModal === 'user' ? 'true' : undefined}
            aria-label="Account / Wallet"
            title="Account / Wallet"
            onClick={(e) => {
              e.stopPropagation();
              
              // Cerrar otros modales antes de abrir User
              closeAllModals();
              setActiveModal('user'); // Marcar como activo

              const mode = isReady ? 'menu' : 'connect';
              panelEvents.open(mode);

              if (isDev) {
                console.debug('[LeftBar] Open wallet bus', {
                  requestedMode: mode,
                  connected,
                  hasPubkey: !!publicKey,
                  isReady,
                });
              }
              closeDrawerIfMobile();
            }}
          >
            <span className="icon-container">
              <UserIcon size={ICON_SIZE} strokeWidth={STROKE} />
            </span>
          </button>

          {/* Settings - SEGUNDO */}
          <button
            type="button"
            className="leftbar-button settings-button"
            data-modal-open={activeModal === 'settings' ? 'true' : undefined}
            aria-label="Settings"
            title="Settings"
            onClick={(e) => {
              e.stopPropagation();
              
              // Cerrar otros modales antes de abrir Settings
              closeAllModals();
              setActiveModal('settings'); // Marcar como activo
              
              if (isDev) console.debug('[LeftBar] Settings opened');
              closeDrawerIfMobile();
            }}
          >
            <span className="icon-container">
              <Settings size={ICON_SIZE} strokeWidth={STROKE} />
            </span>
          </button>

          {/* Theme - Con spacing */}
          <div className="leftbar-theme-pocket">
            <ThemeToggle variant="switch" />
          </div>
        </div>
      </div>

      {/* Settings Panel Modal */}
      {activeModal === 'settings' && (
        <SettingsPanel onClose={returnToChat} />
      )}
    </aside>
  );
}
