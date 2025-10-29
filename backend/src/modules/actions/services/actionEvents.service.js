import logEvent from '#modules/stats/services/eventLogger.service.js';

export const ACTION_EVENT = {
  SEND: 'action_send',
  SEND_FAILED: 'action_send_failed',
  REQUEST_CREATED: 'action_request_created',
  REQUEST_COMPLETED: 'action_request_completed',
  BUY: 'action_buy',
  BUY_FAILED: 'action_buy_failed',
  AGREEMENT_CREATED: 'action_agreement_created',
  AGREEMENT_SIGNED: 'action_agreement_signed',
  AGREEMENT_SETTLED: 'action_agreement_settled',
};

async function safeLog(userWallet, eventType, data = {}) {
  if (!userWallet || !eventType) return;
  try {
    await logEvent(userWallet, eventType, data);
  } catch (error) {
    console.warn(`[actions] Failed to log ${eventType}`, error?.message || error);
  }
}

export async function logActionSend({ actor, to, amount, token, source, txSig, convId }) {
  await safeLog(actor, ACTION_EVENT.SEND, {
    to,
    amount: amount != null ? Number(amount) : null,
    token: token || null,
    source: source || null,
    txSig: txSig || null,
    convId: convId || null,
  });
}

export async function logActionSendFailed({ actor, to, reason, meta }) {
  await safeLog(actor, ACTION_EVENT.SEND_FAILED, {
    to: to || null,
    reason: reason || null,
    meta: meta || null,
  });
}

export async function logActionRequestCreated({ actor, to, amount, token, note, actionUrl }) {
  await safeLog(actor, ACTION_EVENT.REQUEST_CREATED, {
    to: to || null,
    amount: amount != null ? Number(amount) : null,
    token: token || null,
    note: note || null,
    actionUrl: actionUrl || null,
  });
}

export async function logActionRequestCompleted({ actor, from, amount, token, txSig }) {
  await safeLog(actor, ACTION_EVENT.REQUEST_COMPLETED, {
    from: from || null,
    amount: amount != null ? Number(amount) : null,
    token: token || null,
    txSig: txSig || null,
  });
}

export async function logActionBuy({ actor, token, amountInSol, expectedOut, volume, actionUrl, txSig }) {
  await safeLog(actor, ACTION_EVENT.BUY, {
    token: token || null,
    amountInSol: amountInSol != null ? Number(amountInSol) : null,
    expectedOut: expectedOut != null ? Number(expectedOut) : null,
    volume: volume != null ? Number(volume) : null,
    actionUrl: actionUrl || null,
    txSig: txSig || null,
  });
}

export async function logActionBuyFailed({ actor, token, amount, reason }) {
  await safeLog(actor, ACTION_EVENT.BUY_FAILED, {
    token: token || null,
    amount: amount != null ? Number(amount) : null,
    reason: reason || null,
  });
}

export async function logActionAgreementCreated({ actor, agreementId, counterparty, amount, token, deadline }) {
  await safeLog(actor, ACTION_EVENT.AGREEMENT_CREATED, {
    agreementId: agreementId || null,
    counterparty: counterparty || null,
    amount: amount != null ? Number(amount) : null,
    token: token || null,
    deadline: deadline || null,
  });
}

export async function logActionAgreementSigned({ actor, agreementId, stage, txSig }) {
  await safeLog(actor, ACTION_EVENT.AGREEMENT_SIGNED, {
    agreementId: agreementId || null,
    stage: stage || null,
    txSig: txSig || null,
  });
}

export async function logActionAgreementSettled({ actor, agreementId, txSig }) {
  await safeLog(actor, ACTION_EVENT.AGREEMENT_SETTLED, {
    agreementId: agreementId || null,
    txSig: txSig || null,
  });
}
