import { env } from '#config/env.js';

export const SOLANA_RPC_URL = env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
export const SOLANA_COMMITMENT = env.SOLANA_COMMITMENT || 'confirmed';
export const SOLANA_CLUSTER = env.SOLANA_CLUSTER || 'devnet';
export const SOLANA_TIMEOUT_MS = Number.isFinite(env.SOLANA_TIMEOUT_MS)
  ? env.SOLANA_TIMEOUT_MS
  : 20_000;

export function describeSolanaConfig() {
  return {
    rpcUrl: SOLANA_RPC_URL,
    commitment: SOLANA_COMMITMENT,
    cluster: SOLANA_CLUSTER,
    timeoutMs: SOLANA_TIMEOUT_MS,
  };
}
