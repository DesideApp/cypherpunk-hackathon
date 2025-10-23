// src/wallet-adapter/index.ts
import "./core/utils/polyfills"; // 👈 debe ser la primera import

// Adapters
export { PhantomAdapter } from './core/adapters/PhantomAdapter';
export { BackpackAdapter } from './core/adapters/BackpackAdapter';
export { MagicEdenAdapter } from './core/adapters/MagicEdenAdapter';
export { SolflareAdapter } from './core/adapters/SolflareAdapter';

// Core
export { AdapterManager } from './core/utils/AdapterManager';
export { WalletProvider, useWallet } from './core/contexts/WalletProvider';
export { RpcProvider, useRpc } from './core/contexts/RpcProvider';

// Tema / utilidades
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
export { getCssVariable } from './theme/getCssVariable';

// UI (reexport desde features mientras se completa la migración)
export { WalletButton } from '@features/wallet/components/WalletButton';
export { SidePanel } from '@features/wallet/components/SidePanel';
export { WalletMenuContent } from '@features/wallet/components/WalletMenuContent';
export { DefiProfile } from '@features/wallet/components/DefiProfile';
export { default as AuthGateModal } from '@features/auth/ui/components/AuthGateModal';

// UI System
export { panelEvents, PANEL_OPEN_EVENT, PANEL_CLOSE_EVENT } from '@features/auth/ui/system/panel-bus';
export type { PanelMode } from '@features/auth/ui/system/panel-bus';


// Gate (hook + modal)
export { useWalletGate } from './core/hooks/useWalletGate';

// 👇 Web4

// Bridges (auth + adapter wrappers)
export * from './core/bridges/useWalletAuthBridge';
export * from './core/bridges/useJupiterWalletBridge';
