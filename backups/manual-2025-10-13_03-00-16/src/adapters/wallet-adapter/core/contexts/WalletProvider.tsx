import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

import { AdapterManager } from '../utils/AdapterManager';
import type { BaseWalletAdapter } from '../adapters/BaseWalletAdapter';
import { emit } from '../system/events';
import { isWaError, waErr, WaErrorCode } from '../error-handling/errors';

type WalletStatus = 'idle' | 'connecting' | 'connected' | 'locked' | 'error';

interface WalletContextType {
  adapter: BaseWalletAdapter | null;
  publicKey: string | null;
  connected: boolean;
  /** Alias de conveniencia para hosts: status==='connecting' */
  connecting: boolean;
  status: WalletStatus;

  connect: (walletName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;

  // Compat anterior (nombres):
  availableWallets: string[];

  // Nueva API para UI:
  adaptersTrusted: BaseWalletAdapter[];    // Installed (detectados)
  adaptersUntrusted: BaseWalletAdapter[];  // Others (no detectados)
}

const WalletContext = createContext<WalletContextType | null>(null);

// Persistencia:
// - Preferida (no se borra en disconnect): guía autoconexión y "recently used".
const KEY_LAST_WALLET = 'wa:lastWallet';
// - Última conectada (se borra en disconnect para cortar "sesión"/recuerdo).
const KEY_LAST_CONNECTED_WALLET = 'wa:lastConnectedWallet';

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [adapter, setAdapter] = useState<BaseWalletAdapter | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<WalletStatus>('idle');

  const [trustedAdapters, setTrustedAdapters] = useState<BaseWalletAdapter[]>([]);
  const [untrustedAdapters, setUntrustedAdapters] = useState<BaseWalletAdapter[]>([]);
  const [allAdapters, setAllAdapters] = useState<BaseWalletAdapter[]>([]);

  // Detección centralizada: INSTALLED (trusted) vs OTHERS (untrusted, por compat).
  useEffect(() => {
    const manager = new AdapterManager((installed, others) => {
      // Fuerzo nuevas referencias para re-render fiable
      setTrustedAdapters([...installed]);
      setUntrustedAdapters([...others]);
      setAllAdapters([...installed, ...others]);
    });
    return () => manager.dispose();
  }, []);

  const connect = useCallback(
    async (walletName: string) => {
      const selected = allAdapters.find((a) => a.name === walletName && a.available);
      if (!selected) {
        const err = waErr(
          WaErrorCode.INTERNAL_ERROR,
          `Wallet ${walletName} not found or unavailable`,
          'adapter',
          { walletName }
        );
        emit('wa:error', { error: err });
        throw err;
      }

      try {
        // 'connecting' ANTES de abrir popup → permite que el host oculte el Shell
        setStatus('connecting');
        emit('wa:status', { status: 'connecting', wallet: walletName });

        await selected.connect();

        // Persistimos preferida + última conectada
        try {
          localStorage.setItem(KEY_LAST_WALLET, walletName);
          localStorage.setItem(KEY_LAST_CONNECTED_WALLET, walletName);
        } catch {}

        setAdapter(selected);
        setPublicKey(selected.publicKey);
        setConnected(true);
        setStatus('connected');
        // ⚠️ No re‑emitimos 'connected' aquí para evitar duplicar el evento del BaseAdapter.
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.toLowerCase().includes('reject') || e?.code === 4001) {
          setStatus('locked');
          emit('wa:error', {
            error: waErr(
              WaErrorCode.CONNECT_REJECTED,
              `User rejected in ${walletName}`,
              'provider',
              { walletName },
              e
            ),
          });
        } else {
          setStatus('error');
          emit('wa:error', {
            error: waErr(
              WaErrorCode.CONNECT_FAILED,
              `Connect failed in ${walletName}: ${msg || 'unknown'}`,
              'provider',
              { walletName },
              e
            ),
          });
        }
        throw e;
      }
    },
    [allAdapters]
  );

  const disconnect = useCallback(async () => {
    try {
      await adapter?.disconnect?.();
      // ⚠️ No emitimos wa:status aquí: el BaseAdapter ya emite 'idle' en disconnect.
    } catch (e) {
      const err = isWaError(e)
        ? e
        : waErr(
            WaErrorCode.DISCONNECT_FAILED,
            String((e as any)?.message || e),
            'adapter',
            {},
            e
          );
      emit('wa:error', { error: err });
      // Continuamos con limpieza lógica igualmente
    } finally {
      try {
        localStorage.removeItem(KEY_LAST_CONNECTED_WALLET);
      } catch {}

      setPublicKey(null);
      setConnected(false);
      setAdapter(null);
      setStatus('idle');

      // Compat: evento global para listeners existentes
      try {
        window.dispatchEvent(new Event('walletDisconnected'));
      } catch {}
    }
  }, [adapter]);

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      try {
        if (!adapter) throw new Error('Wallet not connected');
        // El adapter acepta string/bytes y devuelve SIEMPRE Base58 string.
        return await adapter.signMessage(message);
      } catch (e) {
        const err = isWaError(e)
          ? e
          : waErr(
              WaErrorCode.SIGN_FAILED,
              String((e as any)?.message || e),
              'adapter',
              {},
              e
            );
        emit('wa:error', { error: err });
        throw err;
      }
    },
    [adapter]
  );

  // Account change → sincroniza publicKey y estado (maneja null robustamente).
  useEffect(() => {
    if (!adapter) return;

    const onAccountChange = (newPubkey: string | null) => {
      if (!newPubkey) {
        try {
          localStorage.removeItem(KEY_LAST_CONNECTED_WALLET);
        } catch {}
        setPublicKey(null);
        setConnected(false);
        setStatus('idle');
        // Para compatibilidad con listeners existentes
        try {
          window.dispatchEvent(new Event('walletDisconnected'));
        } catch {}
        return;
      }
      setPublicKey(newPubkey);
      setConnected(true);
      setStatus('connected');
    };

    adapter.on?.('accountChanged', onAccountChange);
    return () => adapter.off?.('accountChanged', onAccountChange);
  }, [adapter]);

  // Autoconexión silenciosa si la preferida está disponible y "desbloqueada" (sin forzar popup).
  useEffect(() => {
    let cancelled = false;

    const autoReconnect = async () => {
      if (adapter || connected || allAdapters.length === 0) return;

      const preferred =
        (typeof window !== 'undefined' && localStorage.getItem(KEY_LAST_WALLET)) ??
        (typeof window !== 'undefined' && localStorage.getItem(KEY_LAST_CONNECTED_WALLET));
      if (!preferred) return;

      const target = allAdapters.find((a) => a.name === preferred);
      if (!target || !target.available) return;

      let unlocked = false;
      try {
        unlocked = !!(await target.isUnlocked?.());
      } catch {
        unlocked = false;
      }
      if (!unlocked) return; // no abrimos popup en autoconnect

      try {
        setStatus('connecting');
        emit('wa:status', { status: 'connecting', wallet: target.name });

        await target.connect();
        if (cancelled) return;

        setAdapter(target);
        setPublicKey(target.publicKey);
        setConnected(true);
        setStatus('connected');
        // ⚠️ No re‑emitimos 'connected' (lo hace el BaseAdapter).
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          const err = isWaError(e)
            ? e
            : waErr(
                WaErrorCode.CONNECT_FAILED,
                'Auto-reconnect failed',
                'adapter',
                { preferred },
                e
              );
          emit('wa:error', { error: err });
        }
      }
    };

    autoReconnect();
    return () => {
      cancelled = true;
    };
  }, [adapter, connected, allAdapters]);

  return (
    <WalletContext.Provider
      value={{
        adapter,
        publicKey,
        connected,
        connecting: status === 'connecting',
        status,
        connect,
        disconnect,
        signMessage,
        availableWallets: allAdapters.map((w) => w.name),
        adaptersTrusted: trustedAdapters,     // Installed
        adaptersUntrusted: untrustedAdapters, // Others
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
};
