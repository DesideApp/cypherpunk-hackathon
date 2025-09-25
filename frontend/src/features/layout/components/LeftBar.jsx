// src/components/layout/LeftBar.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, User as UserIcon, ArrowLeftRight } from 'lucide-react';
import { useLayout } from '@features/layout/contexts/LayoutContext';
import { panelEvents } from '@wallet-adapter/ui/system/panel-bus';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { useRpc } from '@wallet-adapter/core/contexts/RpcProvider';
import { useAuth, AUTH_STATUS } from '@features/auth/contexts/AuthContext.jsx';
import ThemeToggle from '@features/layout/components/ThemeToggle.jsx';
import './LeftBar.css';
import bs58 from 'bs58';

const ICON_SIZE = 20;
const STROKE = 2;
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
const swapEnabled = String(import.meta.env?.VITE_FEATURE_SWAP ?? 'false').toLowerCase() === 'true';

const LeftBarLogo = () => {
  const { theme } = useLayout();
  const logoSrc = theme === 'dark' ? '/assets/logo-dark.svg' : '/assets/logo-light.svg';
  return <img src={logoSrc} alt="Logo" className="leftbar-logo-icon" />;
};

export default function LeftBar() {
  const { isTablet, isMobile, setRightPanelOpen, leftbarExpanded, theme } = useLayout();
  const { adapter, status: walletStatus, connected, publicKey, connect, availableWallets } = useWallet();
  const { endpoint } = useRpc();
  const { status: authStatus } = useAuth();
  const isReady = authStatus === AUTH_STATUS.READY;
  const walletConnected = Boolean(publicKey);

  const location = useLocation();
  const navigate = useNavigate();

  const isDrawerOpen = (isTablet || isMobile) && leftbarExpanded;

  // ===== Jupiter Plugin integration =====
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const pluginBootstrappedRef = useRef(false);

  const REFERRAL_ACCOUNT = "DVQmBebnW3M6ckxxHnZnMyUgD6598oz6hmi7FU2v5sBX";
  const REFERRAL_FEE_BPS = 20;

  const getBranding = (t) => {
    const base = t === 'dark' ? '/assets/logo-dark.svg' : '/assets/logo-light.svg';
    return { logoUri: `${base}?v=${t}`, name: 'Deside Swap' };
  };

  function buildJupiterWalletPassthrough(adapter, status) {
    if (!adapter) return null;
    const signMessage =
      typeof adapter.signMessage === 'function'
        ? async (msg) => {
            const asString = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
            const sig = await adapter.signMessage(asString);
            return typeof sig === 'string' ? new Uint8Array(bs58.decode(sig)) : sig;
          }
        : undefined;

    return {
      connected: !!adapter.publicKey,
      connecting: status === 'connecting',
      publicKey: adapter.publicKey || null,
      signTransaction: adapter.signTransaction?.bind(adapter),
      signAllTransactions: adapter.signAllTransactions?.bind(adapter),
      signMessage,
      disconnect: adapter.disconnect?.bind(adapter),
    };
  }

  function initJupiter({ branding, endpoint, walletPassthrough, onConnectRequest }) {
    const enablePass = !!walletPassthrough;
    const cfg = {
      displayMode: 'modal',
      formProps: {
        referralAccount: REFERRAL_ACCOUNT,
        referralFee: REFERRAL_FEE_BPS,
      },
      enableWalletPassthrough: enablePass,
      endpoint,
      onRequestConnectWallet: onConnectRequest,
      branding,
    };
    if (enablePass) {
      cfg.passthroughWalletContextState = { wallet: walletPassthrough };
    }
    window.Jupiter.init(cfg);
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
          initJupiter({
            branding,
            endpoint,
            walletPassthrough: buildJupiterWalletPassthrough(adapter, walletStatus),
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
  }, [theme, scriptLoaded, endpoint, adapter, walletStatus, connect, availableWallets]);

  useEffect(() => {
    if (!scriptLoaded || !window.Jupiter || !pluginBootstrappedRef.current) return;
    const walletPassthrough = buildJupiterWalletPassthrough(adapter, walletStatus);
    const enablePass = !!walletPassthrough;
    if (typeof window.Jupiter.setProps === 'function') {
      try {
        const props = { endpoint };
        if (enablePass) {
          Object.assign(props, {
            enableWalletPassthrough: true,
            passthroughWalletContextState: { wallet: walletPassthrough },
          });
        } else {
          Object.assign(props, { enableWalletPassthrough: false });
        }
        window.Jupiter.setProps(props);
        return;
      } catch {}
    }
    pluginBootstrappedRef.current = false;
  }, [adapter, walletStatus, endpoint, scriptLoaded]);

  const openJupiterSwap = async () => {
    if (!swapEnabled) return;
    if (!walletConnected) {
      try { panelEvents.open('connect'); } catch {}
      if (availableWallets?.[0]) connect(availableWallets[0]);
      return;
    }
    await ensurePluginLoaded();
    if (!window.Jupiter) return;
    if (!pluginBootstrappedRef.current) {
      initJupiter({
        branding: getBranding(theme),
        endpoint,
        walletPassthrough: buildJupiterWalletPassthrough(adapter, walletStatus),
        onConnectRequest: () => {
          try { panelEvents.open('connect'); } catch {}
          if (availableWallets?.[0]) connect(availableWallets[0]);
        },
      });
      pluginBootstrappedRef.current = true;
    }
    (window.Jupiter.resume?.() || window.Jupiter.open?.());
  };

  const pages = [
    { path: '/', icon: <MessageCircle size={ICON_SIZE} strokeWidth={STROKE} />, label: 'Chat' },
    ...(swapEnabled ? [{ action: () => openJupiterSwap(), icon: <ArrowLeftRight size={ICON_SIZE} strokeWidth={STROKE} />, label: 'Swap' }] : []),
  ];

  const isActive = (path) => location.pathname === path;

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
            const active = link.path ? isActive(link.path) : false;
            return (
              <button
                key={link.path || link.label}
                type="button"
                className={`leftbar-button ${active ? 'active' : ''}`}
                aria-label={link.label}
                aria-current={active ? 'page' : undefined}
                title={link.label}
                onClick={(e) => {
                  e.stopPropagation();
                  if (link.action) {
                    link.action();
                    if (isDev) console.debug('[LeftBar] Action', link.label);
                  } else if (link.path) {
                    navigate(link.path);
                    if (isDev) console.debug('[LeftBar] Navigate', link.path);
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
          {/* Account / Wallet */}
          <button
            type="button"
            className="leftbar-button user-button"
            aria-label="Account / Wallet"
            title="Account / Wallet"
            onClick={(e) => {
              e.stopPropagation();
              setRightPanelOpen(false);

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
            }}
          >
            <span className="icon-container">
              <UserIcon size={ICON_SIZE} strokeWidth={STROKE} />
            </span>
          </button>

          {/* Ajustes y otros botones inferiores eliminados; mantenemos sólo wallet + theme */}

          {/* Theme */}
          <div className="leftbar-theme-pocket">
            <ThemeToggle variant="switch" />
          </div>
        </div>
      </div>
    </aside>
  );
}
