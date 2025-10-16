// src/types/jupiter-plugin.d.ts
export {};

declare global {
  interface Window {
    Jupiter?: JupiterGlobal;
  }
}

export interface JupiterInitOptions {
  /**
   * Modo de visualización:
   * - 'modal': abre un modal flotante
   * - 'integrated': incrusta el widget en un contenedor
   */
  displayMode?: 'modal' | 'integrated';

  /**
   * Props del formulario (referral, tokens por defecto, etc.)
   */
  formProps?: {
    referralAccount?: string; // address donde cobras fees
    referralFee?: number;     // en bps, p.ej. 20 = 0.20%
    defaultInputMint?: string;
    defaultOutputMint?: string;
  };

  /**
   * Si en el futuro quieres pasar tu contexto de wallet propio:
   */
  enableWalletPassthrough?: boolean;
  passthroughWalletContextState?: unknown;

  /**
   * RPC opcional (si no, usa el del plugin)
   */
  endpoint?: string;

  /**
   * Callbacks de UX (opcionales)
   */
  onSuccess?: (e: { txid: string }) => void;
  onSwapError?: (e: { error: unknown }) => void;
}

export interface JupiterGlobal {
  /**
   * Inicializa el plugin (debe llamarse 1 sola vez)
   */
  init(opts: JupiterInitOptions): void;

  /**
   * Abre el modal (si displayMode = 'modal')
   */
  open(): void;

  /**
   * Cierra/destruye (opcionales, según versión del plugin)
   */
  close?(): void;
  destroy?(): void;

  /**
   * Flag helper que algunos ejemplos usan para no reinicializar
   */
  isInitialized?: boolean;
}
