import { io as ioExport } from "#shared/services/websocketServer.js";
import { getRelayStore } from '#modules/relay/services/relayStoreProvider.js';
import { resolveQuota, checkQuota, applyQuota } from '#modules/relay/services/quota.service.js';
import logger from '#config/logger.js';

function base64Json(value) {
  const json = JSON.stringify(value ?? {});
  return Buffer.from(json, "utf8").toString("base64");
}

function byteLength(value) {
  return Buffer.byteLength(value || "", "utf8");
}

function resolveConvId({ convId, participants = [] }) {
  if (convId) return convId;
  if (participants.length === 2) {
    const [a, b] = participants.slice().sort();
    return `${a}:${b}`;
  }
  return null;
}

export async function sendAgreementUpdate({
  agreement,
  receipt,
  fromWallet,
  toWallet,
  stage = null,
  role = null,
  clientId,
}) {
  if (!agreement || !toWallet || !fromWallet) return;

  const stageValue = stage || receipt?.status || null;
  const roleValue = role || null;
  const messageId = clientId || `${agreement.id}:${roleValue || stageValue || "update"}`;
  const convId = resolveConvId({
    convId: agreement.conversationId,
    participants: agreement.participants || [],
  });

  const payload = {
    type: "agreement:update",
    agreementId: agreement.id,
    status: stageValue,
    role: roleValue,
    agreement,
    receipt,
    preview: agreement?.title ? `Agreement: ${agreement.title}` : "Agreement update",
    timestamp: new Date().toISOString(),
  };

  const box = base64Json(payload);
  const boxSize = byteLength(box);

  const meta = {
    kind: "agreement",
    agreementId: agreement.id,
    convId,
    clientId: messageId,
    messageId,
    from: fromWallet,
    to: toWallet,
    status: stageValue,
    role: roleValue,
  };

  const relayStore = getRelayStore();
  const existing = await relayStore.findById(messageId);
  const previousSize = existing?.boxSize || 0;
  const deltaBytes = boxSize - previousSize;

  let quotaCtx;
  try {
    quotaCtx = await resolveQuota({ wallet: toWallet, incomingBytes: boxSize, deltaBytes });
    const quotaCheck = checkQuota(quotaCtx);
    if (!quotaCheck.allowed) {
      const err = new Error(`relay quota check failed: ${quotaCheck.reason}`);
      err.code = quotaCheck.reason;
      err.details = quotaCheck.details;
      throw err;
    }

    await applyQuota(
      { ...quotaCtx },
      relayStore,
      {
        messageId,
        to: toWallet,
        from: fromWallet,
        box,
        boxSize,
        iv: null,
        messageType: "agreement",
        meta,
      }
    );
  } catch (error) {
    logger.warn('[Relay] sendAgreementUpdate failed', {
      messageId,
      toWallet,
      code: error?.code,
      details: error?.details,
      error: error?.message,
    });
    throw error;
  }

  const ioInstance = ioExport;
  try {
    ioInstance?.to?.(toWallet)?.emit?.("relay:flush", [messageId]);
  } catch {}

  return { messageId };
}
