import { useMemo } from 'react';
import { useWallet } from '../contexts/WalletProvider';

/**
 * Interfaz mínima que Jupiter suele necesitar para "wallet passthrough".
 * Nota: firmar/txs se pasan tal cual; el plugin puede llamar signMessage(msg: Uint8Array).
 */
type JupiterWallet = {
  publicKey: string;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  signAllTransactions?: (txs: unknown[]) => Promise<unknown[]>;
};

export function useJupiterWalletBridge(): JupiterWallet | null {
  const { adapter, publicKey, connected } = useWallet() as unknown as {
    adapter: {
      signMessage?: (msg: string) => Promise<string | Uint8Array>;
      signTransaction?: (tx: unknown) => Promise<unknown>;
      signAllTransactions?: (txs: unknown[]) => Promise<unknown[]>;
    } | null;
    publicKey: string | null;
    connected: boolean;
  };

  return useMemo(() => {
    if (!adapter || !connected || !publicKey) return null;

    const wallet: JupiterWallet = { publicKey };

    // Adaptamos signMessage: Jupiter envía bytes → tu adapter espera string.
    if (adapter.signMessage) {
      wallet.signMessage = async (msg: Uint8Array) => {
        const utf8Msg =
          typeof TextDecoder !== 'undefined'
            ? new TextDecoder().decode(msg)
            : String.fromCharCode(...msg);

        const sig = await adapter.signMessage!(utf8Msg);

        // Jupiter espera bytes: si tu adapter devuelve Base58 string, lo decodificamos.
        if (typeof sig === 'string') {
          try {
            return base58Decode(sig);
          } catch {
            // Si no es Base58 (improbable), devolvemos UTF-8 del string
            return typeof TextEncoder !== 'undefined'
              ? new TextEncoder().encode(sig)
              : Uint8Array.from(sig.split('').map((c) => c.charCodeAt(0)));
          }
        }
        return sig;
      };
    }

    if (adapter.signTransaction) {
      wallet.signTransaction = adapter.signTransaction.bind(adapter);
    }
    if (adapter.signAllTransactions) {
      wallet.signAllTransactions = adapter.signAllTransactions.bind(adapter);
    }

    return wallet;
  }, [adapter, publicKey, connected]);
}

/* ------------------------ utils locales (agnósticas) ------------------------ */
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP = (() => {
  const m = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    m[BASE58_ALPHABET.charCodeAt(i)] = i as any;
  }
  return m;
})();

function base58Decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;

  const size = (((str.length - zeros) * 733) / 1000 + 1) | 0;
  const b256 = new Uint8Array(size);
  let length = 0;

  for (let i = zeros; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 128 || BASE58_MAP[c] === -1) {
      throw new Error('Invalid Base58 character');
    }
    let carry = BASE58_MAP[c];
    let j = 0;
    for (let k = size - 1; (carry !== 0 || j < length) && k >= 0; k--, j++) {
      carry += 58 * b256[k];
      b256[k] = carry % 256;
      carry = (carry / 256) | 0;
    }
    length = j;
  }

  let it = size - length;
  while (it < size && b256[it] === 0) it++;

  const out = new Uint8Array(zeros + (size - it));
  out.fill(0, 0, zeros);
  let p = zeros;
  while (it < size) out[p++] = b256[it++];
  return out;
}
