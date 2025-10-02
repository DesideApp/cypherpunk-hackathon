// src/features/messaging/clients/relayClient.js
// Cliente canónico de Relay con mapeo 409/413 y compat (legacy).

import { ENDPOINTS as CONF } from "@shared/config/env.js";
import { authedFetchJson as fetchJson } from "@features/messaging/clients/fetcher.js";
import { getWalletSignature } from "@shared/services/tokenService.js";

const ENDPOINTS = Object.freeze({
  SEND: CONF?.RELAY?.SEND,
  PULL: CONF?.RELAY?.PULL,
  ACK:  CONF?.RELAY?.ACK,
  CFG:  CONF?.RELAY?.CONFIG,
});

function normalizeThrownError(e, fallbackStatus) {
  const status = e?.status || e?.details?.statusCode || fallbackStatus || 0;
  const msg = e?.message || e?.details?.message || "http-error";
  const err = new Error(msg);
  err.status = status;
  const serverCode = e?.details?.code || e?.details?.error;
  if (serverCode) err.code = serverCode;
  else if (status === 409) err.code = "recipient-online";
  else if (status === 413) err.code = "too-large";
  else if (status === 401 || status === 403) err.code = "auth-stale";
  else err.code = "http-error";
  err.details = e?.details || {};
  return err;
}

async function postJSON(path, body) {
  try {
    const walletSig = getWalletSignature();
    return await fetchJson(path, {
      method: "POST",
      body: JSON.stringify(body || {}),
      headers: { ...(walletSig ? { "X-Wallet-Signature": walletSig } : {}) },
    });
  } catch (e) {
    throw normalizeThrownError(e);
  }
}

async function getJSON(path, query) {
  try {
    const walletSig = getWalletSignature();
    const q = new URLSearchParams(query || {}).toString();
    const p = q ? `${path}?${q}` : path;
    return await fetchJson(p, {
      method: "GET",
      headers: { ...(walletSig ? { "X-Wallet-Signature": walletSig } : {}) },
    });
  } catch (e) {
    throw normalizeThrownError(e);
  }
}

function ensureUuidV4(id) {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  try {
    return id && re.test(id) ? id : crypto?.randomUUID?.() || id || undefined;
  } catch {
    return id || undefined;
  }
}

export async function relayConfig() {
  return getJSON(ENDPOINTS.CFG);
}

export async function enqueue({ to, box, iv = null, msgId, mime, meta, force } = {}) {
  if (!to || !box) {
    const e = new Error("missing-fields");
    e.status = 400;
    e.code = "bad-request";
    throw e;
  }

  const payload = {
    to,
    msgId: ensureUuidV4(msgId),
    box,
    iv,
    ...(mime ? { mime } : {}),
    ...(meta ? { meta } : {}),
    ...(typeof force === 'boolean' ? { force } : {}),
    // Campos “ricos” tolerantes (serán ignorados por legacy)
    from: meta?.from,
    convId: meta?.convId,
    messageType: meta?.kind || 'text',
    encryptedContent: box,
  };

  try {
    const res = await postJSON(ENDPOINTS.SEND, payload);
    const identifier = res?.id || res?.serverId || res?.messageId || null;
    return {
      id: identifier,
      serverId: identifier,
      deliveredAt: res?.deliveredAt || null,
      forced: !!res?.forced,
      warning: res?.warning || null,
      details: res?.details || null,
    };
  } catch (e) {
    if (e.status === 409 && !e.code) e.code = "recipient-online";
    if (e.status === 413 && !e.code) e.code = "too-large";
    throw e;
  }
}

export async function sendEnvelope({ toWallet, clientId, envelope, meta, mime, force } = {}) {
  if (!toWallet) {
    const e = new Error("missing-to");
    e.status = 400;
    e.code = "bad-request";
    throw e;
  }

  const cipher = envelope?.cipher;
  if (!cipher) {
    const e = new Error("missing-envelope");
    e.status = 400;
    e.code = "bad-request";
    throw e;
  }

  const metaPayload = {
    ...(meta || {}),
    ...(envelope?.aad && !meta?.aad ? { aad: envelope.aad } : {}),
  };

  return enqueue({
    to: toWallet,
    box: cipher,
    iv: envelope?.iv || null,
    msgId: clientId,
    mime,
    meta: metaPayload,
    ...(typeof force === 'boolean' ? { force } : {}),
  });
}

export async function pullPending({ cursor, limit } = {}) {
  const query = {};
  if (cursor) query.cursor = cursor;
  if (typeof limit === 'number') query.limit = String(limit);
  const base = ENDPOINTS.PULL.replace(/\/$/, '');
  const res = await getJSON(base, Object.keys(query).length ? query : undefined);
  const messages = Array.isArray(res?.messages)
    ? res.messages
    : Array.isArray(res?.data?.messages)
    ? res.data.messages
    : [];
  const outCursor = res?.cursor ?? res?.data?.cursor ?? res?.nextCursor ?? res?.data?.nextCursor ?? null;
  return { messages, cursor: outCursor };
}

export async function ackDelivered({ ackIds } = {}) {
  const ids = Array.isArray(ackIds) ? ackIds : [ackIds];
  if (!ids.length) return { ok: true };
  await postJSON(ENDPOINTS.ACK, { ids, ackIds: ids });
  return { ok: true };
}

export function sendText() {
  throw new Error('relayClient.sendText is deprecated. Use sendEnvelope().');
}
