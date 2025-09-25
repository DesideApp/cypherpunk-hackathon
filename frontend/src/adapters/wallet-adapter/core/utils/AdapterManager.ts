import { PhantomAdapter } from '../adapters/PhantomAdapter.js';
import { BackpackAdapter } from '../adapters/BackpackAdapter.js';
import { MagicEdenAdapter } from '../adapters/MagicEdenAdapter.js';
import { SolflareAdapter } from '../adapters/SolflareAdapter.js';
import type { BaseWalletAdapter } from '../adapters/BaseWalletAdapter.js';

const PINNED = ['Phantom', 'Solflare', 'Backpack', 'MagicEden'] as const;
const KEY_LAST_WALLET = 'wa:lastWallet';

type UpdateFn = (installed: BaseWalletAdapter[], others: BaseWalletAdapter[]) => void;
type AdapterManagerOpts = { extraAdapters?: BaseWalletAdapter[] };

const DEV = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
const RAW_DEBUG_WALLETS =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_WALLETS !== undefined)
    ? import.meta.env.VITE_DEBUG_WALLETS
    : (typeof process !== 'undefined' ? process.env?.VITE_DEBUG_WALLETS : undefined);
const DEBUG_WALLETS = String(RAW_DEBUG_WALLETS ?? 'false').toLowerCase() === 'true';

export class AdapterManager {
  private adapters: BaseWalletAdapter[] = [];
  /** 🔸 listeners globales (window/document) */
  private globalUnsubs: Array<() => void> = [];
  /** 🔹 listeners por‑adapter (se re‑atachan en cada checkAll) */
  private adapterUnsubs: Array<() => void> = [];
  private debounceId: number | null = null;
  private disposed = false;
  private extraAdapters: BaseWalletAdapter[] = [];

  private installed: BaseWalletAdapter[] = [];
  private others: BaseWalletAdapter[] = [];

  constructor(private onUpdate: UpdateFn, opts?: AdapterManagerOpts) {
    this.extraAdapters = opts?.extraAdapters ?? [];
    this.init();
  }

  /* ------------------------------- lifecycle ------------------------------- */

  private init() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Primer chequeo + reintentos cortos para cubrir “late injection”
    this.checkAll();
    window.setTimeout(() => this.checkAll(), 150);
    window.setTimeout(() => this.checkAll(), 500);

    // Re-chequeos al volver al tab/ventana
    const onFocus = () => this.checkAllDebounced();
    const onVisibility = () => document.visibilityState === 'visible' && this.checkAllDebounced();
    const onPageshow = () => this.checkAllDebounced();
    // Muchas wallets disparan esto al inyectarse (EIP-6963-like)
    const onSolanaInitialized = () => this.checkAllDebounced();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageshow);
    window.addEventListener('solana#initialized', onSolanaInitialized as any);

    this.globalUnsubs.push(() => window.removeEventListener('focus', onFocus));
    this.globalUnsubs.push(() => document.removeEventListener('visibilitychange', onVisibility));
    this.globalUnsubs.push(() => window.removeEventListener('pageshow', onPageshow));
    this.globalUnsubs.push(() => window.removeEventListener('solana#initialized', onSolanaInitialized as any));
  }

  dispose() {
    this.disposed = true;
    try { this.adapterUnsubs.forEach((off) => off()); } catch {}
    try { this.globalUnsubs.forEach((off) => off()); } catch {}
    this.adapterUnsubs = [];
    this.globalUnsubs = [];
  }

  /* ---------------------------------- core --------------------------------- */

  private createAllAdapters(): BaseWalletAdapter[] {
    const defaults = [
      new PhantomAdapter(),
      new SolflareAdapter(),
      new BackpackAdapter(),
      new MagicEdenAdapter(),
    ];
    // Permite inyectar externos sin tocar el core:
    return [...defaults, ...this.extraAdapters];
  }

  private checkAllDebounced() {
    if (this.debounceId) window.clearTimeout(this.debounceId);
    this.debounceId = window.setTimeout(() => this.checkAll(), 60);
  }

  /** 🔹 Limpia SOLO listeners de adaptadores (no globales) */
  private detachAdapterListeners() {
    this.adapterUnsubs.forEach((off) => { try { off(); } catch {} });
    this.adapterUnsubs = [];
  }

  /** 🔹 Ata listeners de adaptadores a la foto actual */
  private attachAdapterListeners() {
    for (const a of this.adapters) {
      const onReady = () => this.checkAllDebounced();
      const onConnect = () => this.checkAllDebounced();
      const onDisconnect = () => this.checkAllDebounced();
      const onAccount = () => this.checkAllDebounced();

      a.on?.('readyStateChange', onReady);
      a.on?.('connect', onConnect);
      a.on?.('disconnect', onDisconnect);
      a.on?.('accountChanged', onAccount);

      this.adapterUnsubs.push(() => a.off?.('readyStateChange', onReady));
      this.adapterUnsubs.push(() => a.off?.('connect', onConnect));
      this.adapterUnsubs.push(() => a.off?.('disconnect', onDisconnect));
      this.adapterUnsubs.push(() => a.off?.('accountChanged', onAccount));
    }
  }

  private checkAll() {
    if (this.disposed) return;

    // 1) Crear adapters frescos (para no “fotografiar” provider=null del boot)
    this.adapters = this.createAllAdapters();

    // 2) Clasificar por disponibilidad (installed vs others)
    const installed: BaseWalletAdapter[] = [];
    const others: BaseWalletAdapter[] = [];

    for (const a of this.adapters) {
      if (a.available) installed.push(a);
      else others.push(a);
    }

    // 3) Orden: recently used → pinned → A–Z
    const last = (typeof window !== 'undefined' && localStorage.getItem(KEY_LAST_WALLET)) || null;

    const priorityIndex = (name: string) => {
      const i = PINNED.indexOf(name as any);
      return i === -1 ? 999 : i;
    };

    const sortBlock = (list: BaseWalletAdapter[]) =>
      list
        .slice()
        .sort((a, b) => {
          if (last) {
            if (a.name === last && b.name !== last) return -1;
            if (b.name === last && a.name !== last) return 1;
          }
          const p = priorityIndex(a.name) - priorityIndex(b.name);
          if (p !== 0) return p;
          return a.name.localeCompare(b.name);
        });

    this.installed = sortBlock(installed);
    this.others = sortBlock(others);

    // --- DEBUG (solo en dev): snapshot final que consumirá la UI ---
    if (DEV && DEBUG_WALLETS) {
      try {
        console.debug(
          '[AdapterManager/v2] installed =',
          this.installed.map((a) => a.name),
          'others =',
          this.others.map((a) => a.name)
        );
        console.table([
          ...this.installed.map((a) => ({ name: a.name, installed: true })),
          ...this.others.map((a) => ({ name: a.name, installed: false })),
        ]);
      } catch { /* noop */ }
    }

    // 4) Re-enganchar SOLO listeners de adaptadores y notificar
    this.detachAdapterListeners();
    this.attachAdapterListeners();

    if (DEV && DEBUG_WALLETS) {
      try {
        console.debug(
          '[AdapterManager/v2] installed =',
          this.installed.map((a) => a.name),
          'others =',
          this.others.map((a) => a.name)
        );
        console.debug(
          '[AdapterManager/v2] (local) installed =',
          installed.map((a) => a.name),
          'others =',
          others.map((a) => a.name)
        );
      } catch { /* noop */ }
    }

    this.onUpdate(this.installed, this.others);
  }

  /* --------------------------------- getters -------------------------------- */

  getTrustedAdapters(): BaseWalletAdapter[] {
    return this.installed;
  }
}
