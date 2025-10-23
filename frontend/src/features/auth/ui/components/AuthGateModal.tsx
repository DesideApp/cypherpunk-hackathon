import React, { useMemo } from 'react';
import { WalletButton } from '@features/wallet/components/WalletButton';
import { panelEvents } from '@features/auth/ui/system/panel-bus';
import { useLayout } from '@features/layout/contexts/LayoutContext.jsx';

type Props = {
  /** Cuando true, el Gate se renderiza SIN overlay propio (lo pone el Shell). */
  inShell?: boolean;

  /** Callback para conmutar a la vista 'panel' dentro del Shell. */
  onRequestConnect?: () => void;

  /** Textos y branding opcionales (igual que legacy). */
  title?: string;
  description?: string;
  brandSrcLight?: string;
  brandSrcDark?: string;

  /** (Opcional) copy auxiliar (tip) y disclaimer legal. */
  showTip?: boolean;
  tipText?: string;

  showDisclaimer?: boolean;
  termsHref?: string;
  privacyHref?: string;
};

export default function AuthGateModal({
  inShell: _inShell = true,
  onRequestConnect,
  title = 'Sign in to start chatting',
  description = 'Own your identity. Own your conversations.',
  brandSrcLight,
  brandSrcDark,
  showTip = true,
  tipText = 'No ads. No tracking. No private data selling.',
  // por defecto el disclaimer NO se muestra en el Gate (lo moveremos al Connect)
  showDisclaimer = false,
  termsHref = '/terms',
  privacyHref = '/privacy',
}: Props) {
  const { isMobile } = useLayout();
  const prefersDark =
    typeof window !== 'undefined'
      ? window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
      : false;
  const brandSrc = prefersDark ? brandSrcDark : brandSrcLight;

  const openConnect = () => {
    // En inShell delegamos al host (conmutará view → 'panel')
    if (onRequestConnect) return onRequestConnect();
    // Fallback por bus global (si alguien lo escucha)
    panelEvents.open('connect');
  };

  // ⚠️ Importante: este componente es “contenido-only”.
  // Nada de overlay ni tarjeta: eso lo pone el Shell.
  const rootStyle = useMemo<React.CSSProperties>(() => ({
    display: 'grid',
    gridAutoRows: 'min-content',
    gap: 18,
    justifyItems: 'center',
    textAlign: 'center',
    width: '100%',
    maxWidth: 480,
    boxSizing: 'border-box',
    padding: isMobile
      ? `calc(36px + var(--safe-area-top, 18px)) clamp(18px, 8vw, 40px) calc(32px + var(--safe-area-bottom, 20px))`
      : '44px 48px 38px',
    margin: '0 auto',
  }), [isMobile]);

  return (
    <div style={rootStyle}>
      {/* Wordmark / marca (opcional) */}
      {brandSrc ? (
        <div style={{ minHeight: 56, display: 'grid', placeItems: 'center', width: '100%' }}>
          <img src={brandSrc} alt="" style={{ maxHeight: 56, maxWidth: 240, objectFit: 'contain' }} />
        </div>
      ) : null}

      {/* Título */}
      <h2
        style={{
          margin: '4px 0 0',
          fontSize: isMobile ? 20 : 22,
          lineHeight: 1.25,
          fontWeight: 800,
          color: 'var(--text-primary, #111827)',
          letterSpacing: '.2px',
        }}
      >
        {title}
      </h2>

      {/* Descripción */}
      <p
        style={{
          margin: '-2px 0 4px',
          fontSize: isMobile ? 13 : 14,
          lineHeight: 1.55,
          color: 'var(--text-secondary, #4b5563)',
          maxWidth: isMobile ? 'min(92vw, 420px)' : 420,
        }}
      >
        {description}
      </p>

      {/* Botón REAL del adapter (usa --action-color) */}
      <div
        style={{
          marginTop: 8,
          display: 'inline-flex',
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          width: isMobile ? '100%' : 'auto',
        }}
      >
        <WalletButton
          kind="primary"
          onClick={openConnect}
          style={{
            minHeight: 44,
            minWidth: isMobile ? undefined : 160,
            width: isMobile ? '100%' : undefined,
            borderRadius: 10,
            fontWeight: 600,
            // el color viene de --action-color en el tema
          }}
        >
          Connect wallet
        </WalletButton>
      </div>

      {/* Tip opcional (copy corto) */}
      {showTip && (
        <p
          style={{
            marginTop: 4,
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--text-secondary, #6b7280)',
            maxWidth: isMobile ? 'min(92vw, 420px)' : 460,
          }}
        >
          {tipText}
        </p>
      )}

      {/* Disclaimer opcional (por defecto oculto en Gate) */}
      {showDisclaimer && (
        <small
          style={{
            marginTop: 2,
            fontSize: 12,
            color: 'var(--text-secondary, #6b7280)',
          }}
        >
          By continuing you agree to our{' '}
          <a className="underline" href={termsHref} target="_blank" rel="noreferrer">
            Terms
          </a>{' '}
          and{' '}
          <a className="underline" href={privacyHref} target="_blank" rel="noreferrer">
            Privacy
          </a>
          .
        </small>
      )}
    </div>
  );
}
