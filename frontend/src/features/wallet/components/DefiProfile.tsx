import { useState } from 'react';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { useSolanaBalance } from '@wallet-adapter/core/hooks/useSolanaBalance';
import { getCssVariable } from '@wallet-adapter/theme/getCssVariable';
import { iconButton } from '../styles/wallet-menu';
import { Copy, Check } from 'lucide-react';

type Props = {
  /** Presentación compacta para el menú (no altera lógica). */
  variant?: 'full' | 'compact';
  /** Oculta la tarjeta de PubKey (p. ej. porque ya se muestra arriba). */
  hidePubkey?: boolean;
};

export const DefiProfile = ({ variant = 'full', hidePubkey = false }: Props) => {
  const { publicKey } = useWallet();
  const balance = useSolanaBalance();
  const [copyOk, setCopyOk] = useState(false);

  const handleCopy = async () => {
    if (!publicKey || copyOk) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1800);
    } catch {
      /* noop */
    }
  };

  const dense = variant === 'compact';

  return (
    <div className="flex flex-col gap-4">
      {/* Public Key Card (opcional) */}
      {!hidePubkey && (
        <div
          style={{
            padding: dense ? 14 : 16,
            borderRadius: 8,
            border: `1px solid ${getCssVariable('--border-color')}`,
            background: getCssVariable('--hover-overlay'),
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: getCssVariable('--text-secondary') }}
            >
              Public Key
            </span>
            <button onClick={handleCopy} aria-label="Copy address" className={iconButton}>
              {copyOk ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
            </button>
          </div>
          <div
            className="font-mono text-sm"
            style={{
              color: getCssVariable('--text-primary'),
              wordBreak: 'break-all',
            }}
          >
            {publicKey || '—'}
          </div>
        </div>
      )}

      {/* Balance Card */}
      <div
        style={{
          padding: dense ? 14 : 16,
          borderRadius: 8,
          border: `1px solid ${getCssVariable('--border-color')}`,
          background: getCssVariable('--surface-color'),
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: getCssVariable('--text-secondary') }}
          >
            Balance
          </span>
          <span
            className="font-mono text-lg font-semibold"
            style={{ color: getCssVariable('--text-primary') }}
          >
            {balance}
          </span>
        </div>
      </div>
    </div>
  );
};
