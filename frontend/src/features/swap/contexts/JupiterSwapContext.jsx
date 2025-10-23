import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

import { useLayout } from '@features/layout/contexts/LayoutContext';
import { panelEvents } from '@features/auth/ui/system/panel-bus';
import { useWallet } from '@wallet-adapter/core/contexts/WalletProvider';
import { useRpc } from '@wallet-adapter/core/contexts/RpcProvider';

const swapEnabled = String(import.meta.env?.VITE_FEATURE_SWAP ?? 'false').toLowerCase() === 'true';
const JUPITER_SCRIPT_SRC = 'https://plugin.jup.ag/plugin-v1.js';
let scriptLoadingPromise = null;

const PASSTHROUGH_SHAPES = {
  CONTEXT: 'context',
  WRAPPED_CONTEXT: 'wrapped-context',
  NONE: 'none',
};

const noopResult = Object.freeze({ opened: false, reason: 'disabled' });

const JupiterSwapContext = createContext({
  swapEnabled: false,
  openSwap: async () => noopResult,
});

export const useJupiterSwap = () => useContext(JupiterSwapContext);

const REFERRAL_ACCOUNT = '6kiaNP1ep5yb64mtTkJGwSH5Lgv4rn9vJo9rbQQj8Ppb';
const REFERRAL_FEE_BPS = 80;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function JupiterSwapProvider({ children }) {
  const { theme } = useLayout();
  const {
    adapter,
    status: walletStatus,
    publicKey,
    connect,
    availableWallets,
  } = useWallet();
  const { endpoint } = useRpc();

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const pluginBootstrappedRef = useRef(false);
  const passthroughShapeRef = useRef(PASSTHROUGH_SHAPES.NONE);

  const J_MODE_RAW = import.meta.env?.VITE_JUPITER_MODE || 'mainnet';
  const J_MODE = String(J_MODE_RAW).toLowerCase();
  const J_RPC_MAIN = import.meta.env?.VITE_JUPITER_RPC_MAINNET;
  const J_RPC_DEV = import.meta.env?.VITE_JUPITER_RPC_DEVNET;
  const jupiterEndpoint = useMemo(
    () =>
      J_MODE === 'mainnet' || J_MODE === 'mainnet-beta'
        ? J_RPC_MAIN || endpoint
        : J_RPC_DEV || endpoint,
    [J_MODE, J_RPC_DEV, J_RPC_MAIN, endpoint],
  );

  const walletConnected = Boolean(publicKey);

  const getBranding = useCallback(
    (t) => {
      const base = t === 'dark' ? '/assets/logo-dark.svg' : '/assets/logo-light.svg';
      return { logoUri: `${base}?v=${t}`, name: 'Deside Swap' };
    },
    [],
  );

  const buildJupiterWalletPassthrough = useCallback(
    (adapterRef, status) => {
      if (!adapterRef) return null;

      const statusConnecting = status === 'connecting';
      const statusConnected = status === 'connected' || !!adapterRef.publicKey;

      let publicKeyObj = null;
      const publicKeyString = adapterRef.publicKey || null;
      try {
        if (publicKeyString) publicKeyObj = new PublicKey(publicKeyString);
      } catch {
        publicKeyObj = null;
      }

      const asUint8Array = (value) => (typeof value === 'string' ? bs58.decode(value) : value);

      const signMessageFn =
        typeof adapterRef.signMessage === 'function'
          ? async (message) => adapterRef.signMessage(message)
          : undefined;
      const sendTransactionFn =
        typeof adapterRef.sendTransaction === 'function'
          ? (...args) => adapterRef.sendTransaction(...args)
          : undefined;
      const signTransactionFn =
        typeof adapterRef.signTransaction === 'function'
          ? (tx) => adapterRef.signTransaction(tx)
          : undefined;
      const signAllTransactionsFn =
        typeof adapterRef.signAllTransactions === 'function'
          ? (txs) => adapterRef.signAllTransactions(txs)
          : undefined;

      const disconnectFn =
        typeof adapterRef.disconnect === 'function'
          ? async () => {
              try {
                await adapterRef.disconnect();
              } catch {}
            }
          : undefined;

      const connectFn =
        typeof adapterRef.connect === 'function'
          ? async () => {
              try {
                await adapterRef.connect();
              } catch (error) {
                throw error;
              }
            }
          : undefined;

      const walletRecord = adapterRef
        ? {
            adapter: adapterRef,
            name: adapterRef.name,
            icon: adapterRef.icon,
            publicKey: publicKeyObj || publicKeyString,
            readyState: 'Installed',
          }
        : null;

      return {
        autoConnect: false,
        wallets: walletRecord ? [walletRecord] : [],
        wallet: walletRecord,
        publicKey: publicKeyObj || publicKeyString,
        connecting: statusConnecting,
        connected: statusConnected,
        disconnecting: false,
        select: () => {},
        connect: connectFn,
        disconnect: disconnectFn,
        sendTransaction: sendTransactionFn,
        signTransaction: signTransactionFn,
        signAllTransactions: signAllTransactionsFn,
        signMessage: signMessageFn,
      };
    },
    [],
  );

  const initJupiterRobust = useCallback(
    ({ branding, endpoint: endpointRef, walletPassthrough, onConnectRequest }) => {
      const base = {
        displayMode: 'modal',
        formProps: {
          referralAccount: REFERRAL_ACCOUNT,
          referralFee: REFERRAL_FEE_BPS,
        },
        endpoint: endpointRef,
        onRequestConnectWallet: onConnectRequest,
        branding,
      };

      const attempts = [];
      if (walletPassthrough) {
        attempts.push({
          shape: PASSTHROUGH_SHAPES.CONTEXT,
          props: {
            ...base,
            enableWalletPassthrough: true,
            passthroughWalletContextState: walletPassthrough,
          },
        });
        attempts.push({
          shape: PASSTHROUGH_SHAPES.WRAPPED_CONTEXT,
          props: {
            ...base,
            enableWalletPassthrough: true,
            passthroughWalletContextState: { wallet: walletPassthrough },
          },
        });
      }
      attempts.push({
        shape: PASSTHROUGH_SHAPES.NONE,
        props: { ...base, enableWalletPassthrough: false },
      });

      for (const attempt of attempts) {
        try {
          window.Jupiter.init(attempt.props);
          passthroughShapeRef.current = attempt.shape;
          return attempt.shape;
        } catch {
          try {
            window.Jupiter.close?.();
          } catch {}
          try {
            window.Jupiter.destroy?.();
          } catch {}
        }
      }

      passthroughShapeRef.current = PASSTHROUGH_SHAPES.NONE;
      return PASSTHROUGH_SHAPES.NONE;
    },
    [],
  );

  const ensurePluginLoaded = useCallback(async () => {
    if (scriptLoaded && typeof window !== 'undefined' && window.Jupiter) return true;
    if (typeof window === 'undefined') return false;

    if (scriptLoadingPromise) return scriptLoadingPromise;

    const existingScript = document.querySelector(`script[src="${JUPITER_SCRIPT_SRC}"]`);
    if (existingScript && window.Jupiter) {
      setScriptLoaded(true);
      return true;
    }

    scriptLoadingPromise = new Promise((resolve, reject) => {
      const scriptEl = existingScript || document.createElement('script');
      if (!existingScript) {
        scriptEl.src = JUPITER_SCRIPT_SRC;
        scriptEl.async = true;
        document.body.appendChild(scriptEl);
      }
      scriptEl.addEventListener(
        'load',
        () => {
          setScriptLoaded(true);
          scriptLoadingPromise = null;
          resolve(true);
        },
        { once: true },
      );
      scriptEl.addEventListener(
        'error',
        (err) => {
          scriptLoadingPromise = null;
          reject(err);
        },
        { once: true },
      );
    });

    return scriptLoadingPromise;
  }, [scriptLoaded]);

  useEffect(() => {
    if (!scriptLoaded || typeof window === 'undefined' || !window.Jupiter) return;
    const branding = getBranding(theme);
    if (typeof window.Jupiter.setBranding === 'function') {
      try {
        window.Jupiter.setBranding(branding);
        return;
      } catch {}
    }
    if (typeof window.Jupiter.setProps === 'function') {
      try {
        window.Jupiter.setProps({ branding });
        return;
      } catch {}
    }
    if (pluginBootstrappedRef.current) {
      const wasOpen =
        (typeof window.Jupiter.isOpen === 'function' && window.Jupiter.isOpen()) ||
        !!document.querySelector('[data-jupiter-modal="open"], jupiter-terminal');

      if (wasOpen) {
        window.Jupiter.close?.();
        requestAnimationFrame(() => {
          initJupiterRobust({
            branding,
            endpoint: jupiterEndpoint,
            walletPassthrough: buildJupiterWalletPassthrough(adapter, walletStatus),
            onConnectRequest: () => {
              try {
                panelEvents.open('connect');
              } catch {}
              if (availableWallets?.[0]) connect(availableWallets[0]);
            },
          });
          (window.Jupiter.resume?.() || window.Jupiter.open?.());
        });
      } else {
        pluginBootstrappedRef.current = false;
      }
    }
  }, [
    adapter,
    availableWallets,
    buildJupiterWalletPassthrough,
    connect,
    getBranding,
    initJupiterRobust,
    jupiterEndpoint,
    scriptLoaded,
    theme,
    walletStatus,
  ]);

  useEffect(() => {
    if (!scriptLoaded || typeof window === 'undefined' || !window.Jupiter || !pluginBootstrappedRef.current) return;
    const walletPassthrough = buildJupiterWalletPassthrough(adapter, walletStatus);
    const enablePass = !!walletPassthrough;
    if (typeof window.Jupiter.setProps === 'function') {
      try {
        const props = { endpoint: jupiterEndpoint };
        if (enablePass) {
          const shape = passthroughShapeRef.current;
          if (shape === PASSTHROUGH_SHAPES.NONE) {
            Object.assign(props, { enableWalletPassthrough: false });
          } else {
            const passthroughValue =
              shape === PASSTHROUGH_SHAPES.WRAPPED_CONTEXT ? { wallet: walletPassthrough } : walletPassthrough;
            Object.assign(props, {
              enableWalletPassthrough: true,
              passthroughWalletContextState: passthroughValue,
            });
          }
        } else {
          Object.assign(props, { enableWalletPassthrough: false });
        }
        window.Jupiter.setProps(props);
        return;
      } catch {}
    }
    pluginBootstrappedRef.current = false;
  }, [adapter, buildJupiterWalletPassthrough, jupiterEndpoint, scriptLoaded, walletStatus]);

  const openSwap = useCallback(
    async ({ beforeOpen, afterOpen } = {}) => {
      if (!swapEnabled) return { opened: false, reason: 'disabled' };
      beforeOpen?.();

      await delay(100);

      if (!walletConnected) {
        try {
          panelEvents.open('connect');
        } catch {}
        if (availableWallets?.[0]) connect(availableWallets[0]);
        return { opened: false, reason: 'wallet' };
      }

      await ensurePluginLoaded();
      if (typeof window === 'undefined' || !window.Jupiter) return { opened: false, reason: 'plugin_unavailable' };

      const openSafely = () => window.Jupiter.resume?.() || window.Jupiter.open?.();

      if (!pluginBootstrappedRef.current) {
        const walletContextState = buildJupiterWalletPassthrough(adapter, walletStatus);
        initJupiterRobust({
          branding: getBranding(theme),
          endpoint: jupiterEndpoint,
          walletPassthrough: walletContextState,
          onConnectRequest: () => {
            try {
              panelEvents.open('connect');
            } catch {}
            if (availableWallets?.[0]) connect(availableWallets[0]);
          },
        });
        pluginBootstrappedRef.current = true;
        try {
          openSafely();
        } catch {
          try {
            window.Jupiter.close?.();
          } catch {}
          try {
            window.Jupiter.destroy?.();
          } catch {}
          passthroughShapeRef.current = PASSTHROUGH_SHAPES.NONE;
          initJupiterRobust({
            branding: getBranding(theme),
            endpoint,
            walletPassthrough: null,
            onConnectRequest: () => {
              try {
                panelEvents.open('connect');
              } catch {}
              if (availableWallets?.[0]) connect(availableWallets[0]);
            },
          });
          openSafely();
        }
        afterOpen?.();
        return { opened: true };
      }

      try {
        openSafely();
        afterOpen?.();
        return { opened: true };
      } catch {
        return { opened: false, reason: 'open_failed' };
      }
    },
    [
      adapter,
      availableWallets,
      buildJupiterWalletPassthrough,
      connect,
      endpoint,
      ensurePluginLoaded,
      getBranding,
      initJupiterRobust,
      jupiterEndpoint,
      theme,
      walletConnected,
      walletStatus,
    ],
  );

  const value = useMemo(
    () => ({
      swapEnabled,
      openSwap,
    }),
    [openSwap],
  );

  return <JupiterSwapContext.Provider value={value}>{children}</JupiterSwapContext.Provider>;
}
