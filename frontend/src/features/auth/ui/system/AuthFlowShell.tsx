import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Portal } from '@features/auth/ui/system/Portal';
import { getCssVariable } from '@wallet-adapter/theme/getCssVariable';
import { useLayout } from '@features/layout/contexts/LayoutContext.jsx';
import { X } from 'lucide-react';

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
  onClose,
}: Props) {
  const { isMobile } = useLayout();
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 640px)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsCompact(event.matches);
    };

    // Initial sync (MatchMediaList doesn't emit immediate event in some browsers)
    handleChange(media);

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  const compact = isMobile || isCompact;
  const showGate  = view === 'gate';
  const showPanel = view === 'panel';

  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleCloseClick = useCallback(
    (event?: React.MouseEvent<HTMLButtonElement>) => {
      event?.stopPropagation();
      onClose?.();
    },
    [onClose]
  );

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
  const safeTop = 'var(--safe-area-top, 24px)';
  const safeBottom = 'var(--safe-area-bottom, 20px)';
  const compactCardHeight = `calc(100vh - ${safeTop} - ${safeBottom})`;

  const overlayStyle = useMemo<React.CSSProperties>(() => ({
    position: 'fixed',
    inset: 0,
    zIndex: 100000,
    // overlay no bloquea; backdrop y card sí (pointerEvents: 'auto')
    pointerEvents: 'none',
  }), []);

  const backdropStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: compact ? 0 : leftInsetPx,
    background: 'rgba(0,0,0,0.40)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    pointerEvents: 'auto', // no cerramos desde aquí (hard‑gate)
  }), [compact, leftInsetPx]);

  const centerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: compact ? 'flex-start' : 'center',
    padding: compact ? `${safeTop} 0 ${safeBottom}` : 0,
    pointerEvents: 'none', // interacciones solo en la card
    overflowY: compact ? 'auto' : 'visible',
  }), [compact, safeTop, safeBottom]);

  // === Card contenedora: auto-sizing por CSS Grid (sin medir en JS)
  const cardStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    position: 'relative',
    display: 'grid',
    gridAutoRows: 'min-content',
    width: compact ? '100vw' : 'var(--wa-modal-width, 560px)',
    maxWidth: compact
      ? '100vw'
      : `min(640px, calc(100vw - ${leftInsetPx + 32}px))`,
    minHeight: compact ? compactCardHeight : MIN_CARD_H,
    maxHeight: compact ? compactCardHeight : undefined,
    height: compact ? compactCardHeight : undefined,
    background: getCssVariable('--window-background'),
    border: compact ? 'none' : `1px solid ${getCssVariable('--border-color')}`,
    borderRadius: compact ? 0 : 16,
    boxShadow: compact ? 'none' : '0 18px 56px rgba(0,0,0,.28), 0 1px 0 rgba(255,255,255,.06) inset',
    padding: 0,
    overflow: compact ? 'auto' : 'hidden',
    WebkitOverflowScrolling: compact ? 'touch' : undefined,
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: '999px',
    border: `1px solid ${getCssVariable('--border-color')}`,
    background: getCssVariable('--surface-color', '#0f172a'),
    color: getCssVariable('--text-secondary', '#cbd5f5'),
    display: 'grid',
    placeItems: 'center',
    boxShadow: '0 12px 26px rgba(15, 23, 42, 0.28)',
    pointerEvents: 'auto',
    zIndex: 10,
  };

  // Capas apiladas con Grid (no absolute). Las dos están montadas SIEMPRE.
  const layerBase: React.CSSProperties = {
    gridArea: '1 / 1',
    transition: `opacity ${DUR}ms ${EASE}, transform ${DUR}ms ${EASE}`,
    willChange: 'opacity, transform',
    ...(compact
      ? {
          height: '100%',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }
      : {}),
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
            {compact && typeof onClose === 'function' && (
              <button
                type="button"
                aria-label="Close modal"
                onClick={handleCloseClick}
                style={closeButtonStyle}
              >
                <X size={18} />
              </button>
            )}
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
