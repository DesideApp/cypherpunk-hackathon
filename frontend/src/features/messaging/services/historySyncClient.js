// src/features/messaging/services/historySyncClient.js
// Helper para sincronizar mensajes RTC con el historial vía backend.

import { ENDPOINTS } from "@shared/config/env.js";
import { authedFetchJson as fetchJson } from "@features/messaging/clients/fetcher.js";

const HISTORY_ENDPOINT = ENDPOINTS?.RELAY?.HISTORY_RTC || "/api/relay/history/rtc";

function base64ByteLength(b64) {
  if (!b64) return 0;
  const normalized = b64.replace(/[\n\r\s]/g, "");
  const len = normalized.length;
  if (!len) return 0;
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

function normalizeParticipants(participants) {
  const set = new Set();
  for (const value of Array.isArray(participants) ? participants : []) {
    if (!value) continue;
    const trimmed = String(value).trim();
    if (trimmed) set.add(trimmed);
  }
  return Array.from(set).sort();
}

function buildHistoryPayload({
  convId,
  sender,
  recipient,
  envelope,
  meta,
  messageId,
  clientMsgId,
  createdAt,
  messageType,
}) {
  const participants = normalizeParticipants([sender, recipient]);
  if (participants.length < 2) {
    throw new Error("history-sync requires at least two participants");
  }
  if (!envelope?.cipher) {
    throw new Error("history-sync missing cipher payload");
  }

  const metaPayload = {
    ...(meta || {}),
    convId: meta?.convId || convId,
    from: meta?.from || sender,
    to: meta?.to || recipient,
  };

  if (envelope?.aad && !metaPayload.aad) metaPayload.aad = envelope.aad;
  if (envelope?.aadB64 && !metaPayload.aadB64) metaPayload.aadB64 = envelope.aadB64;

  const computedType = messageType || metaPayload.kind || "text";
  const timestamp = createdAt != null ? new Date(createdAt) : new Date();
  const safeTimestamp = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;

  return {
    source: "rtc",
    convId,
    participants,
    sender,
    messageId: messageId || clientMsgId,
    clientMsgId: clientMsgId || messageId || undefined,
    box: envelope.cipher,
    boxSize: base64ByteLength(envelope.cipher),
    iv: envelope.iv || null,
    messageType: computedType,
    meta: metaPayload,
    createdAt: safeTimestamp.toISOString(),
  };
}

export async function syncRtcMessageToHistory({
  convId,
  sender,
  recipient,
  envelope,
  meta,
  messageId,
  clientMsgId,
  createdAt,
  messageType,
}) {
  try {
    const payload = buildHistoryPayload({
      convId,
      sender,
      recipient,
      envelope,
      meta,
      messageId,
      clientMsgId,
      createdAt,
      messageType,
    });

    const res = await fetchJson(HISTORY_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return { ok: true, response: res };
  } catch (error) {
    return { ok: false, error };
  }
}

export { buildHistoryPayload };
