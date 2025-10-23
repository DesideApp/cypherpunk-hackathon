import { addRecent } from "@features/messaging/utils/recentConversations.js";
// src/features/messaging/services/inboxService.js
// Pull (Relay) → normalizar → persistir en store → ACK (después de persistir)
// Idempotente por serverId con memoria en proceso; integra flush (socket) con debounce.
// ✅ Depende del relayClient ya canónico (con CSRF en GET/POST).
// ✅ Gate por auth vía 'enabled' (puedes pasarlo conectado a tu estado de Auth).

import * as relay from "../clients/relayClient.js";
import { actions, convId as mkConvId } from "@features/messaging/store/messagesStore.js";
import { base64ToUtf8 } from "@shared/utils/base64.js";
import { createDebugLogger } from "@shared/utils/debug.js";

const DEFAULTS = {
  pollMs: 4000,
  debounceFlushMs: 250,
  maxBatch: 100,
};

export function createInboxService({
  selfWallet,
  pollMs = DEFAULTS.pollMs,
  enabled = true,
  onFlushBind,
  debounceFlushMs = DEFAULTS.debounceFlushMs,
} = {}) {
  let timer = null;
  let stopped = false;
  let fetching = false;
  let cursor = null;
  let pausedByAuth = false;

  let unbindFlush = null;
  let flushTimer = null;
  let flushPending = false;

  let resumeListener = null;

  const seenIds = new Set();
  const ackBacklog = new Set();
  let firstSampleLogged = false;

  const DEBUG = createDebugLogger("inbox", { envKey: "VITE_DEBUG_INBOX_LOGS" });
  const DEBUG_TRANSPORT = createDebugLogger("transport", { envKey: "VITE_DEBUG_TRANSPORT_LOGS" });

  // --- utils
  const safeTs = (ts) => {
    const d = ts ? Date.parse(ts) : Date.now();
    return Number.isFinite(d) ? d : Date.now();
  };

  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const pick = (o, keys) => {
    for (const k of keys) {
      if (o?.[k] !== undefined && o?.[k] !== null && o?.[k] !== "") return o[k];
    }
    return undefined;
  };

  // Normaliza payload del backend → shape amigable para UI/store.
  const normalize = (m) => {
    if (!m) return null;

    // destapar wrappers comunes (data/message/envelope/payload/body)
    const layer1 = isObj(m.data) ? m.data : m;
    const wrapper =
      layer1.envelope || layer1.message || layer1.payload || layer1.body || {};
    const merged = isObj(wrapper) ? { ...layer1, ...wrapper } : layer1;

    // id/ack
    const serverId =
      pick(merged, ["id", "messageId", "msgId", "serverId", "_id", "ackId", "mid", "rid", "ack_id"]) || null;
    if (!serverId) return null;

    // from/to
    let from =
      pick(merged, ["from", "fromWallet", "fromPubkey", "sender", "senderWallet", "author", "sender_wallet"]) || null;
    let to =
      pick(merged, ["to", "toWallet", "recipient", "recipientWallet", "target", "toPubkey", "recipient_wallet"]) || null;

    const meta = isObj(merged.meta) ? merged.meta : (isObj(m.meta) ? m.meta : {});
    if ((!from || !to) && meta) {
      from = from || pick(meta, ["from", "sender", "fromWallet", "senderWallet"]);
      to   = to   || pick(meta, ["to", "recipient", "toWallet", "recipientWallet"]);
      const mcid = meta.convId || meta.conversationId || merged.threadId || null;
      if ((!from || !to) && typeof mcid === "string" && mcid.includes(":")) {
        const [a, b] = mcid.split(":");
        if ((!from || !to) && selfWallet) {
          if (!from) from = (selfWallet === a) ? b : a;
          if (!to)   to   = (from === a) ? b : a;
        }
      }
    }
    if (!to && selfWallet) to = selfWallet;
    if (!from || !to) return null;

    const timestamp = safeTs(
      merged.deliveredAt ||
      merged.createdAt ||
      merged.enqueuedAt ||
      merged.serverAt ||
      merged.ts ||
      merged.timestamp ||
      merged.messageTs
    );

    const messageType = merged.messageType || "text";
    const status = merged.status || "delivered";
    const threadId = merged.threadId || null;
    const replyToId = merged.replyToId || null;
    const isUrgent = !!merged.isUrgent;
    const isEphemeral = !!merged.isEphemeral;
    const clientPlatform = merged.clientPlatform || null;
    const senderCountry = merged.senderCountry || null;

    const hasIv = !!(merged.iv || merged?.envelope?.iv);
    const hasCipher = !!(merged.cipher || merged?.envelope?.cipher);
    const rawBox =
      merged.box ||
      merged.encryptedContent ||
      merged?.payload?.box ||
      merged?.envelope?.box ||
      null;
    const isEncrypted = hasIv || hasCipher;

    let text;
    let media;

    if (typeof merged.text === "string" && merged.text.length) {
      text = merged.text;
    }

    if (!text && !isEncrypted) {
      const mime = merged.mime || merged?.payload?.mime || merged?.envelope?.mime || "";
      if (rawBox) {
        if ((mime || "").startsWith("text/") || !mime) {
          const maybe = base64ToUtf8(rawBox);
          if (typeof maybe === "string" && maybe.length) text = maybe;
          else media = { mime: mime || "application/octet-stream", base64: rawBox };
        } else {
          media = { mime, base64: rawBox };
        }
      }
    }

    let agreementData = merged.agreement || merged?.payload?.agreement || null;
    let receiptData = merged.receipt || merged?.payload?.receipt || null;

    if (typeof text === "string") {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          agreementData = parsed.agreement || agreementData;
          receiptData = parsed.receipt || receiptData;
          if (typeof parsed.preview === "string") text = parsed.preview;
        }
      } catch {
        // ignore parse errors
      }
    }

    if (!text && agreementData?.title) {
      text = `Agreement: ${agreementData.title}`;
    }

    let kind = meta?.kind || messageType || "text";
    if (!meta?.kind) {
      if (messageType && messageType !== "text") {
        kind = messageType;
      } else if (media) {
        kind = "media";
      } else if (text) {
        kind = "text";
      } else if (isEncrypted) {
        kind = "text";
      }
    } else if (media) {
      kind = "media";
    }

    return {
      convId: mkConvId(from, to),
      serverId,
      id: serverId,
      clientId: merged.clientId || merged.clientMsgId || merged.msgId || undefined,
      sender: selfWallet ? (from === selfWallet ? "me" : "other") : "other",
      from,
      to,
      kind,
      text,
      media,
      createdAt: timestamp,
      timestamp,
      isEncrypted,
      status,
      deliveredAt: merged.deliveredAt || timestamp,

      messageType,
      threadId,
      replyToId,
      isUrgent,
      isEphemeral,
      clientPlatform,
      senderCountry,

      meta: {
        ...meta,
        boxSize: merged.boxSize,
        enqueuedAt: merged.enqueuedAt,
        processingTimeMs: merged.processingTimeMs,
      },
      agreement: agreementData || null,
      receipt: receiptData || null,
      envelope: isEncrypted
        ? {
            iv: merged.iv || merged?.envelope?.iv,
            cipher: merged.cipher || merged?.envelope?.cipher || merged.box || merged?.envelope?.box,
            aad: merged.aad || merged?.envelope?.aad,
            aadB64: merged.aadB64 || merged?.envelope?.aadB64,
          }
        : null,
    };
  };

  async function tryAck(ids) {
    if (!ids?.length) return;
    try {
      await relay.ackDelivered({ ackIds: ids });
      ids.forEach(id => ackBacklog.delete(id));
    } catch {
      ids.forEach(id => ackBacklog.add(id));
    }
  }

  // --- ciclo de fetch
  async function tick() {
    if (stopped || !enabled || fetching) return;
    fetching = true;
    try {
      DEBUG("tick start", { cursor });

      if (ackBacklog.size) {
        await tryAck(Array.from(ackBacklog));
      }

      const { messages = [], cursor: next } = await relay.pullPending({ cursor, limit: DEFAULTS.maxBatch });

      if (Array.isArray(messages) && messages.length && !firstSampleLogged) {
        const sample = messages[0] || {};
        const keys = Object.keys(sample).slice(0, 15);
        const deep = Object.keys(sample?.message || sample?.payload || sample?.envelope || sample?.body || {}).slice(0, 15);
        DEBUG("pulled", messages.length);
        DEBUG("sample keys", { root: keys, inner: deep });
        firstSampleLogged = true;
      } else {
        DEBUG("pulled", Array.isArray(messages) ? messages.length : 0);
      }

      let normalized = [];
      if (Array.isArray(messages) && messages.length) {
        normalized = messages
          .map((msg) => {
            const norm = normalize(msg);
            if (norm) {
              if (!norm.via) norm.via = 'relay';
              try {
                DEBUG_TRANSPORT('incoming-relay', {
                  direction: 'incoming',
                  transport: 'relay',
                  convId: norm.convId,
                  serverId: norm.serverId,
                  hasEnvelope: !!norm.envelope,
                });
              } catch {}
            }
            return norm;
          })
          .filter(Boolean)
          .filter(m => {
            const sid = m.id || m.serverId;
            if (!sid) return true;
            if (seenIds.has(sid)) return false;
            seenIds.add(sid);
            return true;
          });

        // Agrupa por conversación y aplica batch
        if (normalized.length) {
          const byConv = new Map();
          for (const m of normalized) {
            const conv = m.convId;
            if (!byConv.has(conv)) byConv.set(conv, []);
            byConv.get(conv).push(m);
          }
          for (const [conv, list] of byConv.entries()) {
            actions.upsertBatch?.(conv, list, selfWallet);
            try {
              const last = list && list.length ? list[list.length - 1] : null;
              const peer = last ? (last.from === selfWallet ? last.to : last.from) : null;
              if (peer) {
                const previewText = last?.text || (last?.kind && last.kind.startsWith("media") ? "Attachment" : "");
                addRecent({ chatId: peer, lastMessageText: previewText, lastMessageTimestamp: last?.createdAt || Date.now() });
              }
            } catch {}
          }
        } else if (messages.length) {
          console.warn("[inbox] received messages but none normalized");
        }

        // ACK después de persistir SOLO si hubo normalizados
        const ackIds = messages
          .map(msg =>
            msg.id || msg.serverId || msg.ackId || msg.msgId || msg._id || msg.messageId || msg.mid || msg.rid || msg.ack_id
          )
          .filter(Boolean);

        if (normalized.length && ackIds.length) await tryAck(ackIds);
      }

      cursor = next || cursor;
    } catch (e) {
      const status = e?.status || e?.details?.statusCode;
      if (status === 401 || status === 403 || e?.code === 'auth-stale') {
        pausedByAuth = true;
        try { window.dispatchEvent(new CustomEvent('inbox:paused:auth')); } catch {}
        stop();
        fetching = false;
        return;
      }
    } finally {
      fetching = false;
    }
  }

  const resume = () => {
    if (!pausedByAuth) return;
    pausedByAuth = false;
    start();
  };

  resumeListener = () => resume();
  try { window.addEventListener('inbox:auth-resume', resumeListener); } catch {}

  // --- control
  function start() {
    if (pausedByAuth) return;
    if (!enabled) return;
    stop();
    stopped = false;
    if (timer) clearInterval(timer);
    timer = setInterval(tick, pollMs);
    tick();

    if (onFlushBind) {
      try { unbindFlush?.(); } catch {}
      unbindFlush = onFlushBind(() => {
        flushPending = true;
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(() => {
          if (!flushPending) return;
          flushPending = false;
          tick();
        }, debounceFlushMs);
      });
    }
  }

  function stop() {
    stopped = true;
    try { clearInterval(timer); } catch {}
    try { clearTimeout(flushTimer); } catch {}
    try { unbindFlush?.(); } catch {}
    timer = null; flushTimer = null; unbindFlush = null;
  }

  async function fetchNow() { await tick(); }

  function reset() {
    try {
      cursor = null;
      seenIds.clear();
      ackBacklog.clear();
      firstSampleLogged = false;
    } catch {}
  }

  return { start, stop, fetchNow, reset };
}
