// src/components/layout/LeftBar.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, User as UserIcon, ArrowLeftRight, Settings, BarChart3 } from 'lucide-react';
import { useLayout } from '@features/layout/contexts/LayoutContext';
import { panelEvents } from '@features/auth/ui/system/panel-bus';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { useAuth, AUTH_STATUS } from '@features/auth/contexts/AuthContext.jsx';
import { useAuthManager } from '@features/auth/hooks/useAuthManager.js';
import ThemeToggle from '@features/layout/components/ThemeToggle.jsx';
import SettingsPanel from '@features/settings/components/SettingsPanel.jsx';
import './LeftBar.css';
import { useJupiterSwap } from '@features/swap/contexts/JupiterSwapContext.jsx';

const ICON_SIZE = 20;
const STROKE = 2;
const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

const LeftBarLogo = () => {
  const { theme } = useLayout();
  const logoSrc = theme === 'dark' ? '/assets/logo-dark.svg' : '/assets/logo-light.svg';
  return <img src={logoSrc} alt="Logo" className="leftbar-logo-icon" />;
};

export default function LeftBar() {
  const { isMobile, leftbarExpanded, setLeftbarExpanded } = useLayout();
  const [activeModal, setActiveModal] = useState(null); // null = Chat (página), 'swap'/'user'/'settings' = Modal activo
  const closeDrawerIfMobile = useCallback(() => {
    if (isMobile) {
      setLeftbarExpanded(false);
    }
  }, [isMobile, setLeftbarExpanded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleActiveModal = (event) => {
      const nextId = event?.detail?.id ?? null;
      setActiveModal(nextId);
    };
    window.addEventListener('deside:setActiveModal', handleActiveModal);
    return () => window.removeEventListener('deside:setActiveModal', handleActiveModal);
  }, []);

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
  const { connected, publicKey } = useWallet();
  const { status: authStatus } = useAuth();
  const isReady = authStatus === AUTH_STATUS.READY;

  const { swapEnabled, openSwap } = useJupiterSwap();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuthManager();

  const isDrawerOpen = isMobile && leftbarExpanded;

  const openSwapFromLeftBar = useCallback(async () => {
    if (!swapEnabled) return;
    closeAllModals();
    setActiveModal('swap');
    try {
      const { opened, reason } = await openSwap();
      if (!opened && reason !== 'wallet') {
        setActiveModal(null);
      }
    } catch (error) {
      if (isDev) console.debug('[LeftBar] Error opening Jupiter swap:', error);
      setActiveModal(null);
    }
  }, [closeAllModals, openSwap, swapEnabled]);

  const pages = [
    { path: '/', icon: <MessageCircle size={ICON_SIZE} strokeWidth={STROKE} />, label: 'Chat' },
    ...(swapEnabled
      ? [
          {
            action: () => openSwapFromLeftBar(),
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
