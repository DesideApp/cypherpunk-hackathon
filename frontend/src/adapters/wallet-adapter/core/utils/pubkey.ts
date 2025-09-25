import { PublicKey } from '@solana/web3.js';

/** Normaliza input a PublicKey (acepta string o PublicKey). */
export const asPk = (x: string | PublicKey): PublicKey =>
  typeof x === 'string' ? new PublicKey(x) : x;

