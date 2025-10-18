import Agreement from '../models/agreement.model.js';
import { AgreementStatus } from '../constants.js';
import { buildSignatureTransaction, verifySignatureTransaction, fetchAgreementTransaction } from '../services/signature.service.js';

function asIsoOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeWallet(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSignatureContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  const blockhash = typeof ctx.blockhash === 'string' && ctx.blockhash.trim()
    ? ctx.blockhash.trim()
    : null;
  const lvhRaw = ctx.lastValidBlockHeight;
  const hasLvh = lvhRaw !== undefined && lvhRaw !== null && String(lvhRaw).trim() !== '';
  const parsedLvh = hasLvh ? Number(lvhRaw) : null;
  const lastValidBlockHeight = Number.isFinite(parsedLvh) ? parsedLvh : null;
  if (!blockhash && lastValidBlockHeight === null) return null;
  return {
    ...(blockhash ? { blockhash } : {}),
    ...(lastValidBlockHeight !== null ? { lastValidBlockHeight } : {}),
  };
}

function pickParticipants({ participants = [], payer, payee, createdBy, selfWallet, peerWallet }) {
  const set = new Set(
    []
      .concat(Array.isArray(participants) ? participants : [])
      .concat(payer ? [payer] : [])
      .concat(payee ? [payee] : [])
      .concat(createdBy ? [createdBy] : [])
      .concat(selfWallet ? [selfWallet] : [])
      .concat(peerWallet ? [peerWallet] : []),
  );
  return Array.from(set).filter(Boolean);
}

function sanitize(agreement) {
  if (!agreement) return null;
  const plain = agreement.toJSON ? agreement.toJSON() : agreement;
  return {
    ...plain,
    receipt: plain.receipt || undefined,
  };
}

export async function createAgreement(req, res) {
  try {
    const creatorWallet = req.user?.wallet;
    const {
      title,
      body = null,
      amount = null,
      token = null,
      payer,
      payee,
      participants,
      deadline,
      conversationId,
      createdBy,
    } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Title is required.' });
    }

    const normalizedCreator = normalizeWallet(createdBy) || creatorWallet;
    if (!normalizedCreator) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Creator wallet missing.' });
    }

    const normalizedPayer = normalizeWallet(payer);
    const normalizedPayee = normalizeWallet(payee);
    if (!normalizedPayer || !normalizedPayee || normalizedPayer === normalizedPayee) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid payer/payee.' });
    }

    const roster = pickParticipants({
      participants,
      payer: normalizedPayer,
      payee: normalizedPayee,
      createdBy: normalizedCreator,
    });

    if (roster.length !== 2) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Agreements must involve exactly two participants.' });
    }

    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Conversation id required.' });
    }

    const deadlineDate = asIsoOrNull(deadline);
    if (deadline && !deadlineDate) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid deadline.' });
    }

    const agreement = await Agreement.create({
      title: title.trim(),
      body: body ? String(body).trim() : null,
      amount: amount ? String(amount) : null,
      token: token ? String(token).toUpperCase() : null,
      payer: normalizedPayer,
      payee: normalizedPayee,
      participants: roster,
      createdBy: normalizedCreator,
      conversationId,
      deadline: deadlineDate,
      receipt: {
        status: AgreementStatus.PENDING_B,
      },
    });

    return res.status(201).json({
      agreement: sanitize(agreement),
      receipt: agreement.receipt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'AGREEMENT_CREATE_FAILED', message: error?.message || 'Unexpected error.' });
  }
}

export async function getAgreement(req, res) {
  try {
    const { id } = req.params;
    const agreement = await Agreement.findById(id);
    if (!agreement) return res.status(404).json({ error: 'AGREEMENT_NOT_FOUND' });
    return res.status(200).json({ agreement: sanitize(agreement) });
  } catch (error) {
    return res.status(500).json({ error: 'AGREEMENT_GET_FAILED', message: error?.message || 'Unexpected error.' });
  }
}

function isExpired(agreement) {
  if (!agreement?.deadline) return false;
  return agreement.deadline.getTime() <= Date.now();
}

function expectedSigner(agreement) {
  const status = agreement?.receipt?.status || AgreementStatus.PENDING_B;
  if (status === AgreementStatus.PENDING_B) {
    return agreement.participants.find((p) => p !== agreement.createdBy);
  }
  if (status === AgreementStatus.PENDING_A) {
    return agreement.createdBy;
  }
  return null;
}

export async function prepareAgreementSignature(req, res) {
  try {
    const { id } = req.params;
    const { signer } = req.body || {};
    const agreement = await Agreement.findById(id);
    if (!agreement) return res.status(404).json({ error: 'AGREEMENT_NOT_FOUND' });

    const normalizedSigner = normalizeWallet(signer);
    if (!normalizedSigner || !agreement.participants.includes(normalizedSigner)) {
      return res.status(403).json({ error: 'NOT_PARTICIPANT' });
    }

    if (isExpired(agreement)) {
      agreement.receipt.status = AgreementStatus.EXPIRED;
      await agreement.save();
      return res.status(409).json({ error: 'DEADLINE_EXPIRED' });
    }

    const expected = expectedSigner(agreement);
    if (!expected) {
      return res.status(409).json({ error: 'STATE_INVALID', message: 'Agreement already signed by both parties.' });
    }

    if (normalizedSigner !== expected) {
      return res.status(409).json({ error: 'INVALID_TURN' });
    }

    const prepared = await buildSignatureTransaction({ agreement, signer: normalizedSigner });

    return res.status(200).json({
      agreement: sanitize(agreement),
      transaction: prepared.transaction,
      memo: prepared.memo,
      hash: prepared.hash,
      context: prepared.context,
    });
  } catch (error) {
    return res.status(500).json({ error: 'AGREEMENT_PREPARE_FAILED', message: error?.message || 'Unexpected error.' });
  }
}

export async function confirmAgreementSignature(req, res) {
  try {
    const { id } = req.params;
    const { signerPubkey, txSig, context: contextRaw } = req.body || {};
    const agreement = await Agreement.findById(id);
    if (!agreement) return res.status(404).json({ error: 'AGREEMENT_NOT_FOUND' });

    const normalizedSigner = normalizeWallet(signerPubkey);
    if (!normalizedSigner) {
      return res.status(403).json({ error: 'NOT_PARTICIPANT' });
    }

    if (!agreement.participants.includes(normalizedSigner)) {
      agreement.participants = Array.from(new Set([...(agreement.participants || []), normalizedSigner]));
      await agreement.save();
    }

    if (isExpired(agreement)) {
      agreement.receipt.status = AgreementStatus.EXPIRED;
      await agreement.save();
      return res.status(409).json({ error: 'DEADLINE_EXPIRED' });
    }

    const expected = expectedSigner(agreement);
    if (!expected) {
      return res.status(409).json({ error: 'STATE_INVALID', message: 'Agreement already signed by both parties.' });
    }
    if (normalizedSigner !== expected) {
      return res.status(409).json({ error: 'INVALID_TURN' });
    }

    if (!txSig || typeof txSig !== 'string' || !txSig.trim()) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Transaction signature required.' });
    }

    const nowSig = txSig.trim();
    const signatureContext = normalizeSignatureContext(contextRaw);
    const verification = await verifySignatureTransaction({
      txSig: nowSig,
      agreement,
      signer: normalizedSigner,
      context: signatureContext,
    });

    if (!verification.ok) {
      return res.status(422).json({
        error: verification.reason || 'TX_NOT_VALID',
        details: verification.details,
      });
    }

    agreement.receipt.lastMemo = verification.memo;

    if (agreement.receipt.status === AgreementStatus.PENDING_B) {
      agreement.receipt.status = AgreementStatus.PENDING_A;
      agreement.receipt.txSigB = nowSig;
      agreement.receipt.signedBAt = new Date();
    } else if (agreement.receipt.status === AgreementStatus.PENDING_A) {
      agreement.receipt.status = AgreementStatus.SIGNED_BOTH;
      agreement.receipt.txSigA = nowSig;
      agreement.receipt.signedAAt = new Date();
    }

    agreement.markModified('receipt');
    await agreement.save();
    return res.status(200).json({
      receipt: agreement.receipt,
      agreement: sanitize(agreement),
    });
  } catch (error) {
    return res.status(500).json({ error: 'AGREEMENT_CONFIRM_FAILED', message: error?.message || 'Unexpected error.' });
  }
}

export async function verifyAgreement(req, res) {
  try {
    const { id } = req.params;
    const agreement = await Agreement.findById(id);
    if (!agreement) return res.status(404).json({ error: 'AGREEMENT_NOT_FOUND' });

    const hasBothSignatures = !!(agreement.receipt?.txSigA && agreement.receipt?.txSigB);
    return res.status(200).json({
      ok: hasBothSignatures,
      receipt: agreement.receipt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'AGREEMENT_VERIFY_FAILED', message: error?.message || 'Unexpected error.' });
  }
}

export async function markAgreementSettled(req, res) {
  try {
    const { id } = req.params;
    const { txSig } = req.body || {};
    const agreement = await Agreement.findById(id);
    if (!agreement) return res.status(404).json({ error: 'AGREEMENT_NOT_FOUND' });

    if (!txSig || typeof txSig !== 'string' || !txSig.trim()) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Transaction signature required.' });
    }

    const signature = txSig.trim();
    const parsed = await fetchAgreementTransaction(signature);
    if (!parsed) {
      return res.status(422).json({ error: 'TX_NOT_FOUND' });
    }
    if (parsed.meta?.err) {
      return res.status(422).json({ error: 'TX_REVERTED', details: parsed.meta.err });
    }

    const accounts = parsed.transaction?.message?.accountKeys || [];
    const hasPayer = accounts.some((acc) => {
      const pk = acc?.pubkey || acc?.toBase58?.() || acc;
      return pk === agreement.payer;
    });
    const hasPayee = accounts.some((acc) => {
      const pk = acc?.pubkey || acc?.toBase58?.() || acc;
      return pk === agreement.payee;
    });

    if (!hasPayer || !hasPayee) {
      return res.status(422).json({
        error: 'PARTICIPANT_MISMATCH',
        details: { expected: [agreement.payer, agreement.payee] },
      });
    }

    agreement.receipt = {
      ...(agreement.receipt || {}),
      settlement: {
        status: 'settled',
        txSig: signature,
        recordedAt: new Date(),
      },
    };

    await agreement.save();

    return res.status(200).json({
      txSig: agreement.receipt.settlement.txSig,
      settlement: agreement.receipt.settlement,
    });
  } catch (error) {
    return res.status(500).json({ error: 'AGREEMENT_SETTLEMENT_FAILED', message: error?.message || 'Unexpected error.' });
  }
}
