import { BaseWalletAdapter } from './BaseWalletAdapter';
import type { WalletAdapterOptions } from './BaseWalletAdapter';
import { solflareIcon } from '@wallet-adapter/core/adapters/icons';

export class SolflareAdapter extends BaseWalletAdapter {
  constructor() {
    const w = typeof window !== 'undefined' ? window : (undefined as any);
    const provider =
      (w?.solflare?.isSolflare ? w.solflare : null) ??
      (w?.solana?.isSolflare ? w.solana : null);

    super({
      name: 'Solflare',
      icon: solflareIcon,
      url: 'https://solflare.com',
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
