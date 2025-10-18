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

function findSignerInParsedTransaction(parsed, signer) {
  const signerStr = toPublicKey(signer, 'signer').toBase58();
  const message = parsed.transaction?.message;
  if (!message) return false;

  const accountKeys = Array.isArray(message.accountKeys) ? message.accountKeys : [];
  const requiredSigners = Number(message.header?.numRequiredSignatures) || 0;

  const found = accountKeys.some((acc, idx) => {
    if (!acc) return false;

    let rawPubkey = null;
    if (typeof acc === 'string') {
      rawPubkey = acc;
    } else if (typeof acc === 'object') {
      rawPubkey = acc.pubkey || (typeof acc.toBase58 === 'function' ? acc.toBase58() : null);
    }

    let pubkey = null;
    if (rawPubkey) {
      try {
        pubkey = toPublicKey(rawPubkey, 'account signer candidate').toBase58();
      } catch (error) {
        logger.warn('[agreement] signer normalize failed', { rawPubkey, error: error?.message });
      }
    }

    if (!pubkey) return false;

    let signerFlag = false;
    if (typeof acc === 'object' && (acc.signer === true || acc.isSigner === true)) {
      signerFlag = true;
    } else if (typeof acc === 'string' || typeof acc === 'object') {
      signerFlag = idx < requiredSigners;
    }

    return signerFlag && pubkey === signerStr;
  });

  if (!found) {
    try {
      const detail = {
        expected: signerStr,
        requiredSigners,
        accountKeys: accountKeys.map((acc, idx) => {
          let rawPubkey = null;
          if (typeof acc === 'string') rawPubkey = acc;
          else if (typeof acc === 'object') rawPubkey = acc?.pubkey || (typeof acc?.toBase58 === 'function' ? acc.toBase58() : null);
          let normalized = null;
          try {
            if (rawPubkey) normalized = toPublicKey(rawPubkey, 'detail').toBase58();
          } catch {}
          return {
            idx,
            pubkey: rawPubkey,
            normalizedPubkey: normalized,
            signerFlag: typeof acc === 'object' ? (acc.signer === true || acc.isSigner === true) : idx < requiredSigners,
            raw: acc,
          };
        }),
      };
      logger.warn(`[agreement] signer mismatch detail ${JSON.stringify(detail)}`);
    } catch {}
  }

  return found;
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

  const rawMemo = extractMemoFromParsedTransaction(parsed) || extractMemoFromLogs(parsed);
  let memo = typeof rawMemo === 'string' ? rawMemo.trim() : rawMemo;
  if (typeof memo === 'string' && memo.startsWith('"') && memo.endsWith('"')) {
    memo = memo.slice(1, -1);
  }

  if (!memo || memo !== expectedMemo) {
    let instructionDump = null;
    try {
      instructionDump = (parsed.transaction?.message?.instructions || []).map((ix) => ({
        program: ix.program || ix.programId?.toString?.(),
        data: ix.data || null,
        parsed: ix.parsed || null,
      }));
    } catch {}
    logger.warn('[agreement] memo mismatch', {
      txSig,
      expected: expectedMemo,
      got: rawMemo || null,
      instructions: instructionDump,
      logs: parsed?.meta?.logMessages || null,
    });
    return {
      ok: false,
      reason: 'MEMO_MISMATCH',
      details: {
        expected: expectedMemo,
        got: rawMemo || null,
        instructions: instructionDump,
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
