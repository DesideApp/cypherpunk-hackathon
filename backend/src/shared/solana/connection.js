import { Connection } from '@solana/web3.js';
import logger from '#config/logger.js';
import { SOLANA_RPC_URL, SOLANA_COMMITMENT, SOLANA_TIMEOUT_MS } from './config.js';

let cachedConnection = null;

export function getConnection() {
  if (cachedConnection) return cachedConnection;

  cachedConnection = new Connection(SOLANA_RPC_URL, {
    commitment: SOLANA_COMMITMENT,
    confirmTransactionInitialTimeout: SOLANA_TIMEOUT_MS,
  });

  try {
    logger.info(`[Solana] Connection initialized → ${SOLANA_RPC_URL} (${SOLANA_COMMITMENT})`);
  } catch {}

  return cachedConnection;
}

export function resetConnection() {
  cachedConnection = null;
}
