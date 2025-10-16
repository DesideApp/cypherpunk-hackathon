import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '../contexts/WalletProvider';

/**
 * Contrato que el bridge espera del backend.
 */
export type WalletAuthHandlers = {
  /** Se avisa en cuanto detectamos que hay conexión (útil para UI). */
  onConnected?: (pubkey: string) => void;
  /** Se avisa al perder conexión o si el flujo falla y hacemos rollback. */
  onDisconnected?: () => void;
  /** Errores del flujo (para toasts/telemetría). */
  onError?: (err: unknown) => void;

  /** Backend: devuelve nonce ligado a pubkey. */
  getNonce: (pubkey: string) => Promise<string>;

  /** Backend: verifica firma (y emite sesión, cookies/JWT…). */
  verifySignature: (pubkey: string, signatureBase58: string, message?: string) => Promise<void>;

  /**
   * Mensaje canónico a firmar.
   * Por defecto: incluye origin+ts para evitar replay y que el usuario vea qué firma.
   */
  makeMessage?: (args: {
    pubkey: string;
    nonce: string;
    origin: string;
    ts: number;
  }) => string | Uint8Array;
};

type BridgeOpts = {
  /**
   * 'onDemand' (por defecto): NUNCA auto‑firma; expone ensureReady() para acciones sensibles.
   * 'auto': firma automáticamente al detectar conexión si aún no hay sesión.
   */
  mode?: 'onDemand' | 'auto';
};

export function useWalletAuthBridge(handlers: WalletAuthHandlers, opts?: BridgeOpts) {
  const { connected, publicKey, signMessage } = useWallet() as unknown as {
    connected: boolean;
    publicKey: string | null;
    signMessage: (msg: string | Uint8Array) => Promise<string | Uint8Array>;
  };

  const [ensuring, setEnsuring] = useState(false);
  const lastAuthedFor = useRef<string | null>(null);
  const handlersRef = useRef(handlers);
  const mode = opts?.mode ?? 'onDemand';
  const busyRef = useRef(false);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  /** Dispara el flujo de autenticación (nonce → sign → verify). */
  const ensureReady = useCallback(async () => {
    if (busyRef.current) return;
    if (!connected || !publicKey) {
      throw new Error('Wallet not connected');
    }
    // Evita firmas repetidas si ya autenticamos exactamente la misma pubkey
    if (lastAuthedFor.current === publicKey) return;

    setEnsuring(true);
    busyRef.current = true;
    try {
      // 1) nonce del backend
      const nonce = await handlersRef.current.getNonce(publicKey);

      // 2) mensaje canónico (origin + timestamp) – SIEMPRE string
      const ts = Date.now();
      const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
      const msgOrBytes =
        handlersRef.current.makeMessage?.({ pubkey: publicKey, nonce, origin, ts }) ??
        [
          'Deside Authentication',
          `Domain: ${origin}`,
          `Address: ${publicKey}`,
          `Nonce: ${nonce}`,
          `Timestamp: ${new Date(ts).toISOString()}`,
        ].join('\n');

      // 3) firmar con la wallet
      const msgToSign = typeof msgOrBytes === 'string' ? msgOrBytes : utf8FromBytes(msgOrBytes);
      const rawSig = await signMessage(msgToSign as any);

      // 4) normaliza firma a Base58 (si ya es string se asume Base58)
      let sigBase58: string;
      if (typeof rawSig === 'string') {
        sigBase58 = rawSig;
      } else if (rawSig instanceof Uint8Array) {
        sigBase58 = base58Encode(rawSig);
      } else if (Array.isArray(rawSig)) {
        sigBase58 = base58Encode(Uint8Array.from(rawSig));
      } else if (rawSig && typeof rawSig === 'object' && 'signature' in (rawSig as any)) {
        const bytes = (rawSig as any).signature as Uint8Array;
        sigBase58 = base58Encode(bytes);
      } else {
        throw new Error('Unknown signature type from wallet');
      }

      // 5) intercambio con el backend (emisión de sesión)
      //    compat: si el handler ignora el 3er argumento, no rompe
      await handlersRef.current.verifySignature(publicKey, sigBase58, msgToSign);

      lastAuthedFor.current = publicKey;
    } catch (err) {
      // rollback estado memorizado para permitir reintento
      lastAuthedFor.current = null;
      try {
        handlersRef.current.onError?.(err);
      } finally {
        // El caller decide si mover a LOGGED_OUT; aquí notificamos desconexión lógica
        handlersRef.current.onDisconnected?.();
      }
      throw err;
    } finally {
      setEnsuring(false);
      busyRef.current = false;
    }
  }, [connected, publicKey, signMessage]);

  // Señalizar cambios de conexión y modo 'auto' si se desea ese comportamiento
  useEffect(() => {
    if (!connected || !publicKey) {
      lastAuthedFor.current = null;
      handlersRef.current.onDisconnected?.();
      return;
    }
    handlersRef.current.onConnected?.(publicKey);

    if (mode === 'auto' && lastAuthedFor.current !== publicKey) {
      // Auto‑firma sólo si opt-in explícito
      ensureReady().catch(() => void 0);
    }
  }, [connected, publicKey, mode, ensureReady]);

  return { ensureReady, ensuring, authedPubkey: lastAuthedFor.current };
}

/* ------------------------ utils locales (agnósticas) ------------------------ */
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  const size = (((bytes.length - zeros) * 138) / 100 + 1) | 0;
  const b58 = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    let j = 0;
    for (let k = size - 1; (carry !== 0 || j < length) && k >= 0; k--, j++) {
      carry += 256 * b58[k];
      b58[k] = carry % 58;
      carry = (carry / 58) | 0;
    }
    length = j;
  }

  let it = size - length;
  while (it < size && b58[it] === 0) it++;

  let str = '';
  for (let i = 0; i < zeros; i++) str += '1';
  for (; it < size; it++) str += BASE58_ALPHABET[b58[it]];
  return str;
}

function utf8FromBytes(bytes: Uint8Array): string {
  return typeof TextDecoder !== 'undefined'
    ? new TextDecoder().decode(bytes)
    : String.fromCharCode(...bytes);
}
