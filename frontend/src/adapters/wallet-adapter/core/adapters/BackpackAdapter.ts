import { BaseWalletAdapter } from './BaseWalletAdapter';
import type { WalletAdapterOptions } from './BaseWalletAdapter';
import { backpackIcon } from '@wallet-adapter/core/adapters/icons';

export class BackpackAdapter extends BaseWalletAdapter {
  constructor() {
    const w = typeof window !== 'undefined' ? window : (undefined as any);
    const provider =
      (w?.backpack?.isBackpack ? w.backpack : null) ??
      (w?.solana?.isBackpack ? w.solana : null);

    super({
      name: 'Backpack',
      icon: backpackIcon,
      url: 'https://backpack.app',
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
