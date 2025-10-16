import type { Wallet, WalletAccount, WalletIcon } from '@wallet-standard/core';
import {
  SolanaSignMessage,
  type SolanaSignMessageFeature,
  type SolanaSignMessageInput,
  type SolanaSignMessageOutput,
} from '@solana/wallet-standard-features';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { emit } from '../system/events';
import { mapProviderError } from '../error-handling/error-map';
import { WaErrorCode, waErr } from '../error-handling/errors';

declare global {
  interface Window {
    solana?: any;
    phantom?: { solana?: any } | any;
    solflare?: any;
    backpack?: any;
    magicEden?: any;
  }
}

export interface WalletProviderInterface {
  connect: (args?: any) => Promise<void>;
  disconnect?: () => Promise<void>;
  publicKey?: { toString: () => string } | string;
  /** Flags de facto que muchos providers exponen */
  isConnected?: boolean;
  isTrusted?: boolean;
  /** Algunas wallets exponen un _publicKey interno */
  _publicKey?: { toString: () => string } | string;

  signMessage?: (
    msg: Uint8Array,
    encoding: string
  ) => Promise<Uint8Array | { signature: Uint8Array }>;

  signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAllTransactions?: (txs: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;

  signVersionedTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  signAllVersionedTransactions?: (txs: VersionedTransaction[]) => Promise<VersionedTransaction[]>;

  on?: (event: string, cb: (arg: any) => void) => void;
}

export interface WalletAdapterOptions {
  name: string;
  icon: WalletIcon;
  url?: string;
  chains: `${string}:${string}`[];
  provider: WalletProviderInterface | null;
}

type WalletEvent = 'connect' | 'disconnect' | 'accountChanged' | 'readyStateChange';
type WalletListeners = { [K in WalletEvent]: Array<(payload: any) => void> };

function pkToString(pk: WalletProviderInterface['publicKey']): string | null {
  if (!pk) return null;
  return typeof pk === 'string' ? pk : pk.toString?.() ?? null;
}
function isVersionedTx(x: Transaction | VersionedTransaction): x is VersionedTransaction {
  return typeof (x as any)?.version !== 'undefined';
}

export class BaseWalletAdapter {
  name: string;
  icon: WalletIcon;
  url?: string;
  chains: `${string}:${string}`[];
  provider: WalletProviderInterface | null;
  publicKey: string | null;
  connected: boolean;
  listeners: WalletListeners;

  constructor({ name, icon, chains, provider, url }: WalletAdapterOptions) {
    this.name = name;
    this.icon = icon;
    this.chains = chains;
    this.provider = provider;
    this.url = url;
    this.publicKey = null;
    this.connected = false;

    this.listeners = {
      connect: [],
      disconnect: [],
      accountChanged: [],
      readyStateChange: [],
    };

    if (this.provider) {
      this.bindLifecycle();
      this.bindAccountChange();
      this.bindReadyStateChange();
    }
  }

  get available(): boolean {
    return !!this.provider;
  }

  /** 🔸 Unificación: flags rápidos → fallback silent connect → sin excepciones */
  async isUnlocked(): Promise<boolean> {
    const p: any = this.provider;
    if (!p) return false;

    const hasFlag =
      !!(pkToString(p.publicKey) ?? pkToString(p._publicKey)) ||
      !!p.isConnected ||
      !!p.isTrusted;

    if (hasFlag) return true;

    // Fallback: intento silencioso (solo si el provider soporta connect)
    if (typeof p.connect === 'function') {
      try {
        await p.connect({ onlyIfTrusted: true });
        const pk = pkToString(p.publicKey) ?? pkToString(p._publicKey);
        return !!pk || !!p.isConnected || !!p.isTrusted;
      } catch {
        // No propagamos error: "no desbloqueada"
        return false;
      }
    }

    return false;
  }

  isReady(): boolean {
    return this.available;
  }

  async connect(): Promise<string | null> {
    try {
  const t0 = performance.now?.() ?? Date.now();
  emit('wa:telemetry', { name: 'connect_start', meta: { wallet: this.name } });
      if (!this.provider) throw new Error(`${this.name} provider not available`);
      await this.provider.connect?.();
      this.publicKey = pkToString(this.provider.publicKey);
      this.connected = !!this.publicKey;
      this.emit('connect', this.publicKey);

      emit('wa:status', { status: 'connected', wallet: this.name });
  emit('wa:telemetry', { name: 'connect_end', dt: (performance.now?.() ?? Date.now()) - t0, meta: { wallet: this.name } });
      return this.publicKey;
    } catch (e) {
      emit('wa:status', { status: 'error', wallet: this.name });
      mapProviderError(e, 'connect'); // lanza WaError
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.provider?.disconnect) {
        await this.provider.disconnect();
      }
      this.publicKey = null;
      this.connected = false;
      this.emit('disconnect', null);

      emit('wa:status', { status: 'idle', wallet: this.name });
    } catch (e) {
      mapProviderError(e, 'disconnect'); // lanza WaError
    }
  }

  /** 🔹 Acepta string o bytes; devuelve SIEMPRE base58 */
  async signMessage(message: string | Uint8Array): Promise<string> {
    try {
  const t0 = performance.now?.() ?? Date.now();
  emit('wa:telemetry', { name: 'sign_start', meta: { wallet: this.name } });
      if (!this.provider?.signMessage) {
        throw waErr(WaErrorCode.SIGN_UNSUPPORTED, `${this.name} does not support message signing`, 'provider');
      }
      const bytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
      const result = await this.provider.signMessage(bytes, 'utf8');
      const signature = 'signature' in result ? result.signature : result;
  const out = bs58.encode(signature);
  emit('wa:telemetry', { name: 'sign_end', dt: (performance.now?.() ?? Date.now()) - t0, meta: { wallet: this.name } });
  return out;
    } catch (e) {
      mapProviderError(e, 'sign'); // lanza WaError tipado
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    const p: any = this.provider;
    if (!p) throw new Error(`${this.name} provider not available`);

    if (isVersionedTx(tx)) {
      if (typeof p.signVersionedTransaction === 'function') return (await p.signVersionedTransaction(tx)) as T;
      if (typeof p.signTransaction === 'function')            return (await p.signTransaction(tx)) as T;
      throw new Error(`${this.name} does not support signing VersionedTransaction`);
    } else {
      if (typeof p.signTransaction === 'function')            return (await p.signTransaction(tx)) as T;
      throw new Error(`${this.name} does not support signing legacy Transaction`);
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    const p: any = this.provider;
    if (!p) throw new Error(`${this.name} provider not available`);
    if (txs.length === 0) return [];

    const first = txs[0];
    const all = async <U extends Transaction | VersionedTransaction>(
      arr: U[],
      unit: (one: U) => Promise<U>
    ): Promise<U[]> => {
      const out: U[] = [];
      for (const t of arr) out.push(await unit(t));
      return out;
    };

    if (isVersionedTx(first)) {
      if (typeof p.signAllVersionedTransactions === 'function') return (await p.signAllVersionedTransactions(txs as VersionedTransaction[])) as T[];
      if (typeof p.signVersionedTransaction === 'function')     return (await all(txs as VersionedTransaction[], p.signVersionedTransaction)) as T[];
      if (typeof p.signAllTransactions === 'function')          return (await p.signAllTransactions(txs as VersionedTransaction[])) as T[];
      if (typeof p.signTransaction === 'function')              return (await all(txs as VersionedTransaction[], p.signTransaction)) as T[];
      throw new Error(`${this.name} does not support signAll for VersionedTransaction`);
    } else {
      if (typeof p.signAllTransactions === 'function')          return (await p.signAllTransactions(txs as Transaction[])) as T[];
      if (typeof p.signTransaction === 'function')              return (await all(txs as Transaction[], p.signTransaction)) as T[];
      throw new Error(`${this.name} does not support signAll for legacy Transaction`);
    }
  }

  on(event: WalletEvent, callback: (payload: any) => void): void {
    this.listeners[event].push(callback);
  }
  off(event: WalletEvent, callback: (payload: any) => void): void {
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }
  protected emit(event: WalletEvent, payload: any): void {
    this.listeners[event].forEach((cb) => cb(payload));
  }

  /** Eventos “de facto” del provider */
  private bindLifecycle(): void {
    this.provider?.on?.('connect', (arg: any) => {
      const pk =
        typeof arg === 'string'
          ? arg
          : pkToString(arg?.publicKey) ?? pkToString(this.provider?.publicKey);
      this.publicKey = pk ?? this.publicKey;
      this.connected = !!this.publicKey;
      this.emit('connect', this.publicKey);
    });

    this.provider?.on?.('disconnect', () => {
      this.publicKey = null;
      this.connected = false;
      this.emit('disconnect', null);
      // Estado global cuando la desconexión viene disparada por la extensión
      emit('wa:status', { status: 'idle', wallet: this.name });
    });
  }

  /** Account change → actualiza estado y, si null, marca también disconnect */
  protected bindAccountChange(): void {
    this.provider?.on?.('accountChanged', (newPk: any) => {
      this.publicKey = pkToString(newPk) ?? pkToString((this.provider as any)?._publicKey);
      this.connected = !!this.publicKey;
      this.emit('accountChanged', this.publicKey);
      // 🔹 si la wallet queda en null, notificar también desconexión
      if (!this.publicKey) {
        this.emit('disconnect', null);
        // Estado global en desconexión por cambio de cuenta a null
        emit('wa:status', { status: 'idle', wallet: this.name });
      }
    });
  }

  protected bindReadyStateChange(): void {
    this.provider?.on?.('readyStateChange', (state: any) => {
      this.emit('readyStateChange', state);
    });
  }

  get wallet(): Wallet & SolanaSignMessageFeature {
    const accounts: WalletAccount[] = this.publicKey
      ? [{
          address: this.publicKey,
          publicKey: bs58.decode(this.publicKey),
          chains: this.chains,
          features: ['solana:signMessage'],
        }]
      : [];

    const signMessageFeature: SolanaSignMessageFeature[typeof SolanaSignMessage] = {
      version: '1.1.0',
      signMessage: async (...inputs: readonly SolanaSignMessageInput[]): Promise<readonly SolanaSignMessageOutput[]> => {
        return Promise.all(
          inputs.map(async ({ message }) => {
            const signed = await this.provider!.signMessage!(message, 'utf8');
            const signature = 'signature' in signed ? signed.signature : signed;
            return {
              signedMessage: message,
              signature,
              signatureType: 'ed25519',
              publicKey: bs58.decode(this.publicKey!),
            };
          })
        );
      },
    };

    return {
      version: '1.0.0',
      name: this.name,
      icon: this.icon,
      chains: this.chains,
      accounts,
      features: { 'solana:signMessage': signMessageFeature },
      [SolanaSignMessage]: signMessageFeature,
    };
  }
}
