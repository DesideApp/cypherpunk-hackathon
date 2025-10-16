// src/wallet-adapter/core/adapters/MagicEdenAdapter.ts
import { BaseWalletAdapter } from './BaseWalletAdapter';
import type { WalletAdapterOptions } from './BaseWalletAdapter';
import { magicEdenIcon } from '@wallet-adapter/core/adapters/icons';

export class MagicEdenAdapter extends BaseWalletAdapter {
  constructor() {
    const w = (typeof window !== 'undefined' ? window : undefined) as any;

    // Candidatos en orden de preferencia + fallback a agregador (nullish chain):
    // - window.magicEden.solana?.isMagicEden
    // - window.magicEden?.isMagicEden
    // - window.solana?.isMagicEden
    // - window.solana?.providers (scan)
    const provider =
      (w?.magicEden?.solana?.isMagicEden ? w.magicEden.solana : null) ??
      (w?.magicEden?.isMagicEden ? w.magicEden : null) ??
      (w?.solana?.isMagicEden ? w.solana : null) ??
      (Array.isArray(w?.solana?.providers)
        ? w.solana.providers.find((p: any) => p?.isMagicEden) ?? null
        : null);

    super({
      name: 'MagicEden',              // ⬅️ nombre único y estable
      icon: magicEdenIcon,
      url: 'https://wallet.magiceden.io',
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
