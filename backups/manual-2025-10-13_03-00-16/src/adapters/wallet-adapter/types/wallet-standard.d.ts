import type { StandardConnectFeature, Wallet } from '@wallet-standard/base';

declare global {
  interface Navigator {
    wallets?: {
      get: () => Wallet[];
      on?: (event: 'register' | 'unregister', listener: () => void) => void;
      off?: (event: 'register' | 'unregister', listener: () => void) => void;
    };
  }
}
