import RelayMessage from "../models/relayMessage.model.js";
import User from "#modules/users/models/user.model.js";
import { io as ioExport } from "#shared/services/websocketServer.js";

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

  const existing = await RelayMessage.findById(messageId).lean();
  const previousSize = existing?.boxSize || 0;

  await RelayMessage.updateOne(
    { _id: messageId },
    {
      $set: {
        to: toWallet,
        from: fromWallet,
        box,
        boxSize,
        iv: null,
        messageType: "agreement",
        meta,
        status: "pending",
        "timestamps.enqueuedAt": new Date(),
      },
      $setOnInsert: {
        _id: messageId,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  const delta = boxSize - previousSize;
  if (delta !== 0) {
    await User.updateOne({ wallet: toWallet }, { $inc: { relayUsedBytes: delta } });
  }

  const ioInstance = ioExport;
  try {
    ioInstance?.to?.(toWallet)?.emit?.("relay:flush", [messageId]);
  } catch {}

  return { messageId };
}
