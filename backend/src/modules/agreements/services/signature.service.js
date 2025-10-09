import crypto from 'crypto';
import { Transaction } from '@solana/web3.js';
import logger from '#config/logger.js';
import { buildMemoInstruction, MEMO_PROGRAM_ID } from '#shared/solana/memo.js';
import { serializeTransaction, toPublicKey } from '#shared/solana/helpers.js';
import { getLatestBlockhash, confirmSignature, getParsedTransaction } from '#shared/solana/transactions.js';

const MEMO_PREFIX = 'AGREEMENT::';

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
  const accountKeys = parsed.transaction?.message?.accountKeys || [];
  return accountKeys.some((acc) => {
    if (!acc) return false;
    const pubkey = acc.pubkey || acc.toBase58?.();
    const signerFlag = acc.signer === true || acc.isSigner === true;
    return signerFlag && pubkey === signerStr;
  });
}

export async function verifySignatureTransaction({ txSig, agreement, signer }) {
  const hash = ensureAgreementHash(agreement);
  const expectedMemo = buildMemoFromHash(hash);

  try {
    await confirmSignature(txSig);
  } catch (error) {
    logger.warn('[agreement] confirmSignature failed', { txSig, error: error?.message });
  }

  const parsed = await getParsedTransaction(txSig);
  if (!parsed) {
    return { ok: false, reason: 'TX_NOT_FOUND' };
  }
  if (parsed.meta?.err) {
    return { ok: false, reason: 'TX_REVERTED', details: parsed.meta.err };
  }

  const memo = extractMemoFromParsedTransaction(parsed) || extractMemoFromLogs(parsed);
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
      got: memo || null,
      instructions: instructionDump,
      logs: parsed?.meta?.logMessages || null,
    });
    return {
      ok: false,
      reason: 'MEMO_MISMATCH',
      details: {
        expected: expectedMemo,
        got: memo || null,
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

  return { ok: true, memo };
}

export { buildMemoFromHash };
