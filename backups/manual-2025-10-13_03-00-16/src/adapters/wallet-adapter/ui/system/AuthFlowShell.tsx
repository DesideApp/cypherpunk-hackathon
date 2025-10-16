// @wallet-adapter/ui/system/AuthFlowShell.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Portal } from '@wallet-adapter/ui/system/Portal';
import { getCssVariable } from '@wallet-adapter/theme/getCssVariable';

type View = 'gate' | 'panel';

type Props = {
  open: boolean;
  view: View;
  gate: React.ReactNode;
  panel: React.ReactNode;
  leftInsetPx?: number;
  onClose?: () => void;
};

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const DUR  = 180;
const MIN_CARD_H = 160;

export default function AuthFlowShell({
  open,
  view,
  gate,
  panel,
  leftInsetPx = 68,
}: Props) {
  const showGate  = view === 'gate';
  const showPanel = view === 'panel';

  const cardRef = useRef<HTMLDivElement | null>(null);

  // === Scroll lock global mientras el Shell está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // === Focus trap dentro de la card (ignora elementos ocultos)
  useEffect(() => {
    if (!open) return;

    const el = cardRef.current;
    if (!el) return;

    const getFocusable = () => {
      const nodes = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      return nodes.filter((n) => {
        if (n.closest('[aria-hidden="true"]')) return false;
        const style = window.getComputedStyle(n);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return n.getClientRects().length > 0;
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = getFocusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const last  = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const id = window.setTimeout(() => {
      const nodes = getFocusable();
      nodes[0]?.focus?.();
    }, 30);

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, view]);

  // === Estilos del overlay/backdrop
  const overlayStyle = useMemo<React.CSSProperties>(() => ({
    position: 'fixed',
    inset: 0,
    zIndex: 100000,
    // overlay no bloquea; backdrop y card sí (pointerEvents: 'auto')
    pointerEvents: 'none',
  }), []);

  const backdropStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: leftInsetPx,
    background: 'rgba(0,0,0,0.40)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    pointerEvents: 'auto', // no cerramos desde aquí (hard‑gate)
  }), [leftInsetPx]);

  const centerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    pointerEvents: 'none', // interacciones solo en la card
  }), []);

  // === Card contenedora: auto-sizing por CSS Grid (sin medir en JS)
  const cardStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    position: 'relative',
    display: 'grid',
    gridAutoRows: 'min-content',
    width: 'var(--wa-modal-width, 560px)',
    maxWidth: `min(640px, calc(100vw - ${leftInsetPx + 32}px))`,
    minHeight: MIN_CARD_H,
    background: getCssVariable('--window-background'),
    border: `1px solid ${getCssVariable('--border-color')}`,
    borderRadius: 16,
    boxShadow: '0 18px 56px rgba(0,0,0,.28), 0 1px 0 rgba(255,255,255,.06) inset',
    padding: 0,
    overflow: 'hidden',
  };

  // Capas apiladas con Grid (no absolute). Las dos están montadas SIEMPRE.
  const layerBase: React.CSSProperties = {
    gridArea: '1 / 1',
    transition: `opacity ${DUR}ms ${EASE}, transform ${DUR}ms ${EASE}`,
    willChange: 'opacity, transform',
  };

  const visible: React.CSSProperties = {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
    pointerEvents: 'auto',
  };

  // Capa oculta: no participa en el alto del contenedor
  const hidden: React.CSSProperties = {
    opacity: 0,
    transform: 'translateY(4px) scale(.997)',
    pointerEvents: 'none',
    visibility: 'hidden',
    height: 0,
    overflow: 'hidden',
  };

  return open ? (
    <Portal>
      <div style={overlayStyle} aria-modal="true" role="dialog">
        <div style={backdropStyle} aria-hidden="true" />
        <div style={centerStyle}>
          <div ref={cardRef} style={cardStyle}>
            {/* Gate (siempre montado) */}
            <div
              style={{ ...layerBase, ...(showGate ? visible : hidden) }}
              aria-hidden={!showGate}
              data-view="gate"
            >
              {gate}
            </div>

            {/* Panel (siempre montado) */}
            <div
              style={{ ...layerBase, ...(showPanel ? visible : hidden) }}
              aria-hidden={!showPanel}
              data-view="panel"
            >
              {panel}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  ) : null;
}
