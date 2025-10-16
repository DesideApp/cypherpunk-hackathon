import { BaseWalletAdapter } from './BaseWalletAdapter';
import type { WalletAdapterOptions } from './BaseWalletAdapter';
import { phantomIcon } from '@wallet-adapter/core/adapters/icons';

export class PhantomAdapter extends BaseWalletAdapter {
  constructor() {
    const w = typeof window !== 'undefined' ? window : (undefined as any);
    // Prioriza el provider dedicado; fallback al agregado si expone isPhantom
    const provider =
      w?.phantom?.solana ??
      (w?.solana?.isPhantom ? w.solana : null);

    super({
      name: 'Phantom',
      icon: phantomIcon,
      url: 'https://phantom.app',
      chains: ['solana:mainnet'],
      provider,
    } satisfies WalletAdapterOptions);
  }

  async isUnlocked(): Promise<boolean> {
    const p: any = (this as any).provider;
    if (!p) return false;
    const pk = p.publicKey ?? p._publicKey;
    return !!(pk || p.isConnected || p.isTrusted);
  }
}
