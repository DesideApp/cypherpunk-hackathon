import { getConnection } from './connection.js';
import { SOLANA_COMMITMENT } from './config.js';

export async function getLatestBlockhash() {
  const connection = getConnection();
  return connection.getLatestBlockhash(SOLANA_COMMITMENT);
}

export async function confirmSignature(signature, context) {
  const connection = getConnection();
  if (context?.blockhash && context?.lastValidBlockHeight) {
    return connection.confirmTransaction(
      { signature, blockhash: context.blockhash, lastValidBlockHeight: context.lastValidBlockHeight },
      SOLANA_COMMITMENT,
    );
  }
  return connection.confirmTransaction(signature, SOLANA_COMMITMENT);
}

export async function getParsedTransaction(signature) {
  const connection = getConnection();
  return connection.getParsedTransaction(signature, {
    commitment: SOLANA_COMMITMENT,
    maxSupportedTransactionVersion: 0,
  });
}
