// @wallet-adapter/ui/panels/SidePanel.tsx
import React, { useEffect, useRef } from 'react';
import { Portal } from '@wallet-adapter/ui/system/Portal';
import { getCssVariable } from '@wallet-adapter/theme/getCssVariable';
import type { CSSProperties, ReactNode } from 'react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Cuando true, el clic en el overlay y ESC NO cierran el panel */
  disableBackdropClose?: boolean;
  /** Ancho del sheet (puede sobreescribirse por CSS var --wa-panel-width) */
  widthPx?: number;
}

export const SidePanel = ({
  isOpen,
  onClose,
  children,
  disableBackdropClose = false,
  widthPx = 420,
}: SidePanelProps) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Scroll lock
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // ESC y focus-trap (si no es hard)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableBackdropClose) onClose();
      if (e.key !== 'Tab' || !sheetRef.current) return;

      const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    // Initial focus will be handled by content components
    
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, disableBackdropClose]);

  if (!isOpen) return null;

  // === Estilos (drawer lateral IZQUIERDO, safe-area LeftBar) ===
  // Los cálculos garantizan: overlay arranca justo al terminar el panel → blur + sombra sólo hacia la derecha
  const overlayLeft = `calc(
    var(--leftbar-width, 68px) +
    min(var(--wa-panel-width, ${widthPx}px), calc(100vw - var(--leftbar-width, 68px)))
  )`;

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    // deja libre rail + panel → el overlay empieza donde termina el panel
    left: overlayLeft,
    // capa 1: un degradado de 32px que simula la sombra hacia la derecha
    // capa 2: scrim homogéneo con blur
    // se reduce la opacidad ~40% para suavizar la sombra
    background: `
      linear-gradient(to right,
        rgba(0,0,0,.11) 0,
        rgba(0,0,0,.06) 16px,
        rgba(0,0,0,0) 48px
      ),
      rgba(0,0,0,.19)
    `,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    pointerEvents: 'auto',
    zIndex: 9998,
  };

  const hostStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    left: 'var(--leftbar-width, 68px)', // pegado al rail
    display: 'flex',
    justifyContent: 'flex-start',        // sheet a la izquierda
    alignItems: 'stretch',
    pointerEvents: 'none',
    zIndex: 9999, // por debajo del Shell (100000)
  };

  const sheetStyle: CSSProperties = {
    pointerEvents: 'auto',
    width: `min(var(--wa-panel-width, ${widthPx}px), calc(100vw - var(--leftbar-width, 68px)))`,
    maxWidth: 560,
    height: '100%',
    background: getCssVariable('--window-background'),
    color: getCssVariable('--text-on-window'),
    // contacto natural con el rail: sin sombra ni borde a la izquierda
    borderLeft: 'none',
    // del lado del contenido mantenemos una "línea" limpia
    borderRight: `1px solid ${getCssVariable('--border-color')}`,
    // sin box-shadow (si no, aparece arriba/abajo): la "sombra" vive en el overlay
    transform: 'translateX(0)',
    transition: 'transform 180ms cubic-bezier(.2,.8,.2,1)',
    display: 'flex',
    flexDirection: 'column',
  };

  const bodyStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: 0, // el contenido ya gestiona sus propios paddings
  };

  return (
    <Portal>
      {/* Overlay (clic fuera) */}
      <div
        style={overlayStyle}
        onClick={() => {
          if (!disableBackdropClose) onClose();
        }}
        aria-hidden="true"
      />

      {/* Drawer derecho (role=dialog) */}
      <div role="dialog" aria-modal="true" style={hostStyle}>
        <div
          ref={sheetRef}
          style={sheetStyle}
          onClick={(e) => e.stopPropagation()}
          data-wa-panel="menu"
        >
          <div style={bodyStyle}>{children}</div>
        </div>
      </div>
    </Portal>
  );
};

export default SidePanel;
