import React from 'react';
import { UnifiedWalletList } from '@features/auth/ui/components/UnifiedWalletList';
import { getCssVariable } from '@wallet-adapter/theme/getCssVariable';

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
};

export function WalletModalContent({
  onConnected,
  inShell = false,
  showDisclaimer = true,
  termsHref = '/terms',
  privacyHref = '/privacy',
}: Props) {
  if (inShell) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {/* El “body” ya define su estructura y paddings */}
        <UnifiedWalletList onConnected={onConnected} />

        {showDisclaimer && (
          <small
            style={{
              marginTop: 4,
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
