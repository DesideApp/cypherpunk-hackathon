// src/modules/agreements/services/signature.service.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced Solana transaction parsing,
// signer verification logic, and memo extraction from multiple sources.
// Full implementation available in private repository.

import crypto from 'crypto';
import { Transaction } from '@solana/web3.js';
import logger from '#config/logger.js';
import { buildMemoInstruction, MEMO_PROGRAM_ID } from '#shared/solana/memo.js';
import { serializeTransaction, toPublicKey } from '#shared/solana/helpers.js';
import { getLatestBlockhash, confirmSignature, getParsedTransaction } from '#shared/solana/transactions.js';

const MEMO_PREFIX = 'AGREEMENT::';

async function sleep(delayMs) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function fetchAgreementTransaction(
  txSig,
  {
    maxAttempts = 10,
    delayMs = 800,
    context = null,
  } = {},
) {
  let parsed = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await confirmSignature(txSig, context);
    } catch (error) {
      logger.warn('[agreement] confirmSignature failed', { txSig, attempt, error: error?.message });
    }

    parsed = await getParsedTransaction(txSig);
    if (parsed) break;
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }
  return parsed;
}

function agreementFingerprint(agreement) {
  const base = {
    title: agreement?.title || '',
    body: agreement?.body || '',
    amount: agreement?.amount || '',
    token: agreement?.token || '',
    payer: agreement?.payer || '',
    payee: agreement?.payee || '',
    participants: Array.isArray(agreement?.participants) ? [...agreement.participants].sort() : [],
    createdBy: agreement?.createdBy || '',
    deadline: agreement?.deadline ? new Date(agreement.deadline).toISOString() : null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
}

function ensureAgreementHash(agreement) {
  if (agreement?.receipt?.hash) return agreement.receipt.hash;
  return agreementFingerprint(agreement);
}

function buildMemoFromHash(hash) {
  return `${MEMO_PREFIX}${hash}`;
}

export async function buildSignatureTransaction({ agreement, signer }) {
  const signerPk = toPublicKey(signer, 'agreement signer');
  const hash = ensureAgreementHash(agreement);
  const memo = buildMemoFromHash(hash);

  const { blockhash, lastValidBlockHeight } = await getLatestBlockhash();

  const memoInstruction = buildMemoInstruction({ memo, signer: signerPk });

  const tx = new Transaction({
    feePayer: signerPk,
    recentBlockhash: blockhash,
  }).add(memoInstruction);

  const serialized = serializeTransaction(tx);

  return {
    transaction: serialized,
    memo,
    hash,
    context: { blockhash, lastValidBlockHeight },
  };
}

// Simplified memo extraction - production version has advanced parsing logic
function extractMemoFromParsedTransaction(parsed) {
  if (!parsed) return null;
  const instructions = parsed.transaction?.message?.instructions || [];

  for (const instruction of instructions) {
    if (!instruction) continue;
    const program = instruction.program || instruction.programId?.toString?.();
    if (program === 'spl-memo' || program === MEMO_PROGRAM_ID.toBase58()) {
      if (instruction.parsed?.info?.memo) return instruction.parsed.info.memo;
      if (instruction.parsed?.memo) return instruction.parsed.memo;
      if (instruction.data) {
        try {
          return Buffer.from(instruction.data, 'base64').toString('utf8');
        } catch {}
      }
    }
  }
  return null;
}

// Simplified memo extraction from logs - production version has advanced regex matching
function extractMemoFromLogs(parsed) {
  const logs = parsed?.meta?.logMessages;
  if (!Array.isArray(logs)) return null;
  for (const log of logs) {
    if (typeof log !== 'string') continue;
    const match = log.match(/Memo \(len \d+\):\s*(.+)$/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// Simplified signer verification - production version has advanced account key parsing
function findSignerInParsedTransaction(parsed, signer) {
  const signerStr = toPublicKey(signer, 'signer').toBase58();
  const message = parsed.transaction?.message;
  if (!message) return false;

  const accountKeys = Array.isArray(message.accountKeys) ? message.accountKeys : [];
  const requiredSigners = Number(message.header?.numRequiredSignatures) || 0;

  // Simplified check - production version has advanced signer detection
  for (let idx = 0; idx < Math.min(requiredSigners, accountKeys.length); idx += 1) {
    const acc = accountKeys[idx];
    if (!acc) continue;

    let pubkey = null;
    if (typeof acc === 'string') {
      pubkey = acc;
    } else if (typeof acc === 'object') {
      pubkey = acc.pubkey || (typeof acc.toBase58 === 'function' ? acc.toBase58() : null);
    }

    if (pubkey) {
      try {
        const normalized = toPublicKey(pubkey, 'signer check').toBase58();
        if (normalized === signerStr) return true;
      } catch {}
    }
  }

  return false;
}

export async function verifySignatureTransaction({ txSig, agreement, signer, context = null }) {
  const hash = ensureAgreementHash(agreement);
  const expectedMemo = buildMemoFromHash(hash);

  const parsed = await fetchAgreementTransaction(txSig, { context });
  if (!parsed) {
    return { ok: false, reason: 'TX_NOT_FOUND' };
  }
  if (parsed.meta?.err) {
    return { ok: false, reason: 'TX_REVERTED', details: parsed.meta.err };
  }

  // Simplified memo extraction - production version tries multiple methods
  const rawMemo = extractMemoFromParsedTransaction(parsed) || extractMemoFromLogs(parsed);
  let memo = typeof rawMemo === 'string' ? rawMemo.trim() : rawMemo;
  if (typeof memo === 'string' && memo.startsWith('"') && memo.endsWith('"')) {
    memo = memo.slice(1, -1);
  }

  if (!memo || memo !== expectedMemo) {
    logger.warn('[agreement] memo mismatch', {
      txSig,
      expected: expectedMemo,
      got: rawMemo || null,
    });
    return {
      ok: false,
      reason: 'MEMO_MISMATCH',
      details: {
        expected: expectedMemo,
        got: rawMemo || null,
      },
    };
  }

  if (!findSignerInParsedTransaction(parsed, signer)) {
    logger.warn('[agreement] signer mismatch', { txSig, signer: toPublicKey(signer, 'signer').toBase58() });
    return {
      ok: false,
      reason: 'SIGNER_MISMATCH',
    };
  }

  return { ok: true, memo: expectedMemo };
}

export { buildMemoFromHash };
