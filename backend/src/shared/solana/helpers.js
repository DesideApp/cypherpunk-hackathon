import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export function toPublicKey(value, label = 'public key') {
  try {
    if (value instanceof PublicKey) return value;
    if (typeof value === 'string') return new PublicKey(value);
    if (value?.toBase58) return new PublicKey(value.toBase58());
  } catch (error) {
    throw new Error(`Invalid ${label}: ${error?.message || value}`);
  }
  throw new Error(`Invalid ${label}: ${value}`);
}

export function serializeTransaction(tx) {
  const raw = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return Buffer.from(raw).toString('base64');
}

export function deserializeTransaction(base64) {
  const raw = Buffer.from(base64, 'base64');
  try {
    return VersionedTransaction.deserialize(raw);
  } catch {
    return Transaction.from(raw);
  }
}

export function ensureMemoString(memo) {
  if (!memo || typeof memo !== 'string') {
    throw new Error('Memo string required');
  }
  return memo;
}
