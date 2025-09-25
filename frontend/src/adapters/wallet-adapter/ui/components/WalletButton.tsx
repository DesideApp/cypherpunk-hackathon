import { useMemo, type CSSProperties } from 'react';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { getCssVariable } from '@wallet-adapter/theme/getCssVariable';
import { panelEvents } from '@wallet-adapter/ui/system/panel-bus';

export const WalletButton = () => {
  const { connected, publicKey, status } = useWallet();

  const isBusy = status === 'connecting';
  const hasWallet = connected || !!publicKey;

  const handleClick = () => {
    // Agnóstico al auth READY: el host/PanelHost decide si abre o ignora 'menu'.
    panelEvents.open(hasWallet ? 'menu' : 'connect');
  };

  const pubkeyLabel = useMemo(() => {
    if (!publicKey) return 'Connect Wallet';
    const s = String(publicKey);
    return s.length > 10 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
  }, [publicKey]);

  const style: CSSProperties = {
    backgroundColor: getCssVariable('--action-color'),
    fontFamily: getCssVariable('--font-ui-family'),
    fontSize: getCssVariable('--font-ui-size'),
    fontWeight: getCssVariable('--font-ui-weight'),
    color: 'white',
    height: '40px',
    minWidth: '160px',
    padding: '0 14px',
    borderRadius: '10px',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    transition: 'box-shadow 0.2s ease-in-out, opacity .2s ease',
    boxShadow: 'none',
    cursor: isBusy ? 'not-allowed' : 'pointer',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    opacity: isBusy ? 0.7 : 1,
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={style}
      aria-haspopup="dialog"
      aria-label={hasWallet ? 'Open wallet menu' : 'Connect wallet'}
      aria-busy={isBusy}
      disabled={isBusy}
      data-wa="wallet-button"
    >
      <span>{pubkeyLabel}</span>
    </button>
  );
};

export default WalletButton;
