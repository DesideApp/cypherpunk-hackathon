import React, { useEffect, useState } from 'react';
import { UnifiedWalletList } from '@features/auth/ui/components/UnifiedWalletList';
import { getCssVariable } from '@wallet-adapter/theme/getCssVariable';
import { X } from 'lucide-react';

type Props = {
  /** Callback tras completar conexión (opcional). */
  onConnected?: () => void;
  /**
   * Cuando true, se renderiza sólo el "body" para el AuthFlowShell.
   * No añade card/overlay ni encabezados: el Shell pone el contenedor.
   */
  inShell?: boolean;
  /** Mostrar disclaimer legal al pie (por defecto, sí en Connect). */
  showDisclaimer?: boolean;
  termsHref?: string;
  privacyHref?: string;
  onClose?: () => void;
};

export function WalletModalContent({
  onConnected,
  inShell = false,
  showDisclaimer = true,
  termsHref = '/terms',
  privacyHref = '/privacy',
  onClose,
}: Props) {
  if (inShell) {
    const [isCompact, setIsCompact] = useState<boolean>(() => {
      if (typeof window === 'undefined') return false;
      return window.matchMedia('(max-width: 640px)').matches;
    });

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const media = window.matchMedia('(max-width: 640px)');
      const handleChange = (event: MediaQueryListEvent) => {
        setIsCompact(event.matches);
      };

      setIsCompact(media.matches);

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

    const surfaceColor = getCssVariable('--surface-color');
    const borderColor = getCssVariable('--border-color');
    const textPrimary = getCssVariable('--text-primary');
    const textSecondary = getCssVariable('--text-secondary');

    const containerStyle: React.CSSProperties = {
      display: 'grid',
      gap: 20,
      padding: isCompact
        ? '22px max(16px, env(safe-area-inset-left, 16px)) calc(26px + var(--safe-area-bottom, 20px)) max(16px, env(safe-area-inset-right, 16px))'
        : '28px clamp(20px, 5vw, 32px) calc(30px + var(--safe-area-bottom, 24px)) clamp(20px, 5vw, 32px)',
      alignContent: 'start',
      justifyItems: 'stretch',
      height: '100%',
      boxSizing: 'border-box',
    };

    const headerRowStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    };

    const headerContentStyle: React.CSSProperties = {
      display: 'grid',
      gap: 10,
      textAlign: 'left',
      flex: 1,
    };

    const badgeStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      width: 'fit-content',
      padding: '6px 12px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      background: surfaceColor,
      color: textSecondary,
      border: `1px solid ${borderColor}`,
    };

    const titleStyle: React.CSSProperties = {
      margin: 0,
      fontFamily: getCssVariable('--font-title-family'),
      fontSize: '1.35rem',
      fontWeight: 700,
      color: textPrimary,
      letterSpacing: 0.2,
    };

    const subtitleStyle: React.CSSProperties = {
      margin: 0,
      fontSize: 13,
      lineHeight: 1.55,
      color: textSecondary,
      maxWidth: 420,
    };

    const cardStyle: React.CSSProperties = {
      borderRadius: 18,
      border: `1px solid ${borderColor}`,
      background: surfaceColor,
      boxShadow: '0 24px 48px rgba(15, 23, 42, 0.24)',
      overflow: 'hidden',
      padding: 0,
    };

    const disclaimerStyle: React.CSSProperties = {
      marginTop: 4,
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 1.45,
      color: textSecondary,
      opacity: 0.9,
    };

    const closeButtonStyle: React.CSSProperties = {
      flexShrink: 0,
      width: 40,
      height: 40,
      display: 'grid',
      placeItems: 'center',
      borderRadius: 999,
      border: `1px solid ${borderColor}`,
      background: 'rgba(148, 163, 184, 0.15)',
      color: textPrimary,
      transition: 'background 0.18s ease, transform 0.18s ease',
      cursor: 'pointer',
    };

    const showCloseButton = isCompact && typeof onClose === 'function';

    return (
      <div style={containerStyle}>
        <header style={headerRowStyle}>
          <div style={headerContentStyle}>
            <span style={badgeStyle}>Wallet</span>
            <h2 style={titleStyle}>Connect your wallet</h2>
            <p style={subtitleStyle}>
              Choose one of your installed options or install a new provider to continue.
            </p>
          </div>
          {showCloseButton && (
            <button
              type="button"
              aria-label="Close wallet modal"
              onClick={onClose}
              style={closeButtonStyle}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = 'translateY(-1px)';
                event.currentTarget.style.background = 'rgba(148, 163, 184, 0.24)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = 'translateY(0)';
                event.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)';
              }}
            >
              <X size={18} />
            </button>
          )}
        </header>

        <div style={cardStyle}>
          <UnifiedWalletList
            onConnected={onConnected}
            showHeading={false}
            padding={isCompact ? '18px 14px 22px' : '20px 22px 24px'}
          />
        </div>

        {showDisclaimer && (
          <small style={disclaimerStyle}>
            By continuing you agree to our{' '}
            <a className="underline" href={termsHref} target="_blank" rel="noreferrer">
              Terms
            </a>{' '}
            and{' '}
            <a className="underline" href={privacyHref} target="_blank" rel="noreferrer">
              Privacy
            </a>.
          </small>
        )}
      </div>
    );
  }

  // Fallback legacy (por si lo usas fuera del Shell)
  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: getCssVariable('--text-primary'),
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.2,
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={titleStyle}>Select Wallet</div>
      <UnifiedWalletList onConnected={onConnected} />

      {showDisclaimer && (
        <small
          style={{
            marginTop: 6,
            textAlign: 'center',
            fontSize: 12,
            lineHeight: 1.45,
            color: getCssVariable('--text-secondary'),
            opacity: 0.9,
          }}
        >
          By continuing you agree to our{' '}
          <a className="underline" href={termsHref} target="_blank" rel="noreferrer">
            Terms
          </a>{' '}
          and{' '}
          <a className="underline" href={privacyHref} target="_blank" rel="noreferrer">
            Privacy
          </a>.
        </small>
      )}
    </div>
  );
}

export default WalletModalContent;
