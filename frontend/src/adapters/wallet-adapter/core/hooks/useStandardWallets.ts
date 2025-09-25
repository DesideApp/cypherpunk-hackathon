import { useEffect, useState } from 'react';
import type { Wallet } from '@wallet-standard/core';

/**
 * Hook to get all wallets detected by Wallet Standard.
 */
export function useStandardWallets(): Wallet[] {
  const [wallets, setWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    const nav = window?.navigator?.wallets;

    if (!nav || typeof nav.get !== 'function') return;

    const update = () => {
      try {
        const allWallets = nav.get() as Wallet[];
        setWallets(allWallets);
      } catch {
        setWallets([]);
      }
    };

    update();

    const onRegister = () => update();
    const onUnregister = () => update();

    nav.on?.('register', onRegister);
    nav.on?.('unregister', onUnregister);

    return () => {
      nav.off?.('register', onRegister);
      nav.off?.('unregister', onUnregister);
    };
  }, []);

  return wallets;
}
