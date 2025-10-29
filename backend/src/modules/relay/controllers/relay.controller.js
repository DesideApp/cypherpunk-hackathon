import User from "#modules/users/models/user.model.js";
import Contact from "#modules/contacts/models/contact.model.js";
import { ContactStatus } from "#modules/contacts/contact.constants.js";
import { io as ioExport, isWalletOnlineWithTTL } from "#shared/services/websocketServer.js";
import cfg from "#config/runtimeConfig.js";
import config from "#config/appConfig.js";
import logEvent from '#modules/stats/services/eventLogger.service.js';
import { createModuleLogger } from '#config/logger.js';
import { appendMessageToHistory } from '#modules/history/services/history.service.js';
import { getRelayStore } from '#modules/relay/services/relayStoreProvider.js';
import { resolveQuota, checkQuota, applyQuota } from '#modules/relay/services/quota.service.js';
import { relayFetchCounter, observeFetchLatency, relayAckLatency, relayMailboxUsageGauge } from '#modules/relay/services/relayMetrics.js';

const log = createModuleLogger({ module: 'relay.controller' });

const MAX_BOX_BYTES = (cfg?.relay?.maxBoxBytes ?? config.relayMaxBoxBytes);
const OFFLINE_ONLY  = (cfg?.relay?.offlineOnly ?? config.relayOfflineOnly);
const ENABLED       = (cfg?.relay?.enabled ?? config.relayEnabled);

const bLen = (s) => Buffer.byteLength(s || "", "utf8");
const SOLANA_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ───────────────────────── helpers ───────────────────────── */

function trimString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMeta(rawMeta, { sender, dest }) {
  if (!rawMeta || typeof rawMeta !== "object") return null;

  const normalized = {
    kind: trimString(rawMeta.kind),
    agreementId: trimString(rawMeta.agreementId),
    convId: trimString(rawMeta.convId),
    clientId: trimString(rawMeta.clientId),
    from: trimString(rawMeta.from) || trimString(sender),
    to: trimString(rawMeta.to) || trimString(dest),
    step: trimString(rawMeta.step),
    status: trimString(rawMeta.status),
  };

  const entries = Object.entries(normalized).filter(([, value]) => value !== null);
  return entries.length ? Object.fromEntries(entries) : null;
}

/** Mutualidad de contactos: ambos ACCEPTED y no bloqueados */
async function areMutualContacts(a, b) {
  try {
    const [fwd, rev] = await Promise.all([
      Contact.exists({ owner: a, contact: b, status: ContactStatus.ACCEPTED, blocked: { $ne: true } }),
      Contact.exists({ owner: b, contact: a, status: ContactStatus.ACCEPTED, blocked: { $ne: true } }),
    ]);
    return Boolean(fwd && rev);
  } catch (e) {
    // Si el modelo de contactos no está disponible, no bloqueamos el flujo (modo “liberal”)
    log.warn('contact_check_skipped', {
      from: a,
      to: b,
      error: e?.message || e,
    });
    return true;
  }
}

/** ¿Wallet online? comprobando si existe room con miembros para esa pubkey */
function isWalletOnline(io, wallet) {
  try {
    const room = io?.sockets?.adapter?.rooms?.get(String(wallet));
    return Boolean(room && room.size > 0);
  } catch {
    return false;
  }
}

/* ───────────────────────── /relay/enqueue ───────────────────────── */

/**
 * POST /relay/enqueue
 * body: { msgId(UUIDv4), to(pubkey), box(base64 string), iv?(string), force?(boolean) }
 */
export const enqueueMessage = async (req, res) => {
  try {
    if (!ENABLED) return res.status(503).json({ error: "relay-disabled" });

    const sender = req.user?.wallet;
    const { msgId, to, box, iv, force, meta: rawMeta } = req.body || {};
    if (!sender) return res.status(401).json({ error: "unauthorized" });

    // Validaciones de forma
    const dest = String(to || "").trim();
    if (!dest || dest === sender || !SOLANA_PUBKEY.test(dest)) {
      try { await safeLog(sender, 'relay_error', { code: 'invalid_pubkey', to: dest || null }); } catch {}
      return res.status(400).json({ error: "INVALID_PUBKEY", nextStep: "CHECK_INPUT" });
    }
    if (!msgId || typeof msgId !== "string") {
      return res.status(400).json({ error: "MISSING_MSG_ID" });
    }
    if (!UUID_V4.test(msgId)) {
      return res.status(400).json({ error: "INVALID_MSG_ID", nextStep: "CHECK_INPUT" });
    }
    if (!box || typeof box !== "string") {
      return res.status(400).json({ error: "INVALID_MESSAGE_DATA", nextStep: "CHECK_INPUT" });
    }

    // Cap por mensaje (bytes de base64)
    const boxSize = bLen(box);
    if (typeof MAX_BOX_BYTES === "number" && boxSize > MAX_BOX_BYTES) {
      try { await safeLog(sender, 'relay_error', { code: 'payload_too_large', to: dest, max: MAX_BOX_BYTES, got: boxSize }); } catch {}
      return res.status(413).json({ error: "payload-too-large", max: MAX_BOX_BYTES, got: boxSize });
    }

    // Destinatario debe existir
    const recipientUser = await User.findOne({ wallet: dest }).lean();
    if (!recipientUser) {
      return res.status(404).json({ error: "USER_NOT_FOUND", nextStep: "REGISTER_WALLET" });
    }

    // Mutualidad de contactos
    const mutual = await areMutualContacts(sender, dest);
    if (!mutual) {
      try { await safeLog(sender, 'relay_error', { code: 'forbidden_not_contact', to: dest }); } catch {}
      return res.status(403).json({ error: "forbidden" });
    }

    // Política online/offline (ahora con TTL mejorado)
    const ioInstance = req.app?.get?.("io") || ioExport;
    const recipientOnline = isWalletOnlineWithTTL(dest); // Usar TTL de 45s
    const isForced = (recipientOnline && OFFLINE_ONLY && force === true);
    if (recipientOnline && OFFLINE_ONLY && !isForced) {
      try { await safeLog(sender, 'relay_skipped_online', { to: dest, presenceTTL: parseInt(process.env.PRESENCE_TTL_MS || '45000', 10) || 45000 }); } catch {}
      return res.status(409).json({ error: "recipient-online", presenceTTL: parseInt(process.env.PRESENCE_TTL_MS || '45000') });
    }

    // Normalizar metadatos de dominio
    const meta = normalizeMeta(rawMeta, { sender, dest });
    const agreementId = meta?.agreementId || null;
    const kind = meta?.kind || null;
    const messageType = trimString(req.body?.messageType) || kind || 'text';

    const relayStore = getRelayStore();

    const normalizedMsgId = String(msgId);
    let existingMessage = await relayStore.findById(normalizedMsgId);

    if (!existingMessage && agreementId) {
      existingMessage = await relayStore.findByAgreement(dest, agreementId);
    }

    const targetId = existingMessage?.id || normalizedMsgId;
    const finalMeta = meta ? { ...meta } : null;
    if (finalMeta && !finalMeta.clientId) {
      finalMeta.clientId = existingMessage?.meta?.clientId || targetId;
    }

    const previousBoxSize = existingMessage?.boxSize || 0;
    const deltaBytes = boxSize - previousBoxSize;

    let quotaCtx;
    let quotaResult;
    let applyResult;

    try {
      quotaCtx = await resolveQuota({ wallet: dest, incomingBytes: boxSize, deltaBytes });
      quotaResult = checkQuota(quotaCtx);
      if (!quotaResult.allowed) {
        try { await safeLog(sender, 'relay_error', { code: quotaResult.reason, to: dest, ...(quotaResult.details || {}) }); } catch {}
        const status = quotaResult.reason === 'payload-too-large' ? 413 : 409;
        return res.status(status).json({
          error: quotaResult.reason,
          nextStep: quotaResult.reason === 'payload-too-large' ? 'CHECK_INPUT' : 'MANAGE_RELAY',
          details: quotaResult.details,
        });
      }

      applyResult = await applyQuota(
        { ...quotaCtx },
        relayStore,
        {
          messageId: targetId,
          to: dest,
          from: sender,
          box,
          boxSize,
          iv: iv ?? null,
          messageType,
          meta: finalMeta,
        }
      );
    } catch (error) {
      if (error?.code === 'payload-too-large') {
        return res.status(413).json({ error: 'payload-too-large', nextStep: 'CHECK_INPUT', details: error?.details });
      }
      if (error?.code === 'relay-quota-exceeded') {
        try { await safeLog(sender, 'relay_error', { code: 'quota_exceeded', to: dest, ...(error?.details || {}) }); } catch {}
        return res.status(409).json({
          error: 'relay-quota-exceeded',
          nextStep: 'MANAGE_RELAY',
          details: error?.details,
        });
      }
      throw error;
    }

    const targetIdForHistory = applyResult?.result?.document?.id || targetId;
    const createdAt = applyResult?.result?.createdAt || existingMessage?.timestamps?.createdAt || new Date();
    const nowUsed = applyResult?.newUsedBytes ?? quotaCtx.usedBytes + Math.max(0, deltaBytes);
    const isOverflow = nowUsed > (quotaCtx?.quotaBytes ?? 0);

    if (recipientOnline && !OFFLINE_ONLY) {
      ioInstance?.to?.(dest)?.emit?.("relay:flush", [targetIdForHistory]);
    }

    try {
      if (isForced) await safeLog(sender, 'relay_forced_offline', { to: dest });
      await safeLog(sender, 'relay_message', {
        to: dest,
        bytes: boxSize,
        recipientOnline: !!recipientOnline,
        forced: !!isForced,
      });
    } catch {}

    try {
      await appendMessageToHistory({
        convId: finalMeta?.convId,
        participants: [sender, dest],
        sender,
        relayMessageId: targetIdForHistory,
        clientMsgId: req.body?.clientMsgId,
        box,
        boxSize,
        iv,
        messageType,
        meta: finalMeta || undefined,
        createdAt,
      });
    } catch (historyErr) {
      log.warn('history_append_failed', {
        relayMessageId: targetIdForHistory,
        error: historyErr?.message || historyErr,
      });
    }

    return res.status(202).json({
      status: "queued",
      transport: "relay",
      messageId: targetIdForHistory,
      ...(isForced ? { forced: true } : {}),
      ...(isOverflow ? {
        warning: "relay-overflow-grace",
        quotaBytes: quotaCtx.quotaBytes,
        usedBytes: nowUsed,
        gracePct: quotaCtx.gracePct,
      } : {}),
    });
  } catch (err) {
    // No dejes que el logging cause otro 500; y escribe el motivo real en logs del server
    log.error('enqueue_error', {
      error: err?.stack || err?.message || err,
      sender,
      to: dest,
    });
    return res.status(500).json({ error: "FAILED_TO_SEND", code: "UNEXPECTED", details: err?.message || "unknown" });
  }
};

/* ───────────────────────── /relay/fetch ───────────────────────── */

export const fetchMessages = async (req, res) => {
  try {
    if (!ENABLED) return res.status(503).json({ error: "relay-disabled" });
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: "unauthorized" });

    const relayStore = getRelayStore();
    const messages = await relayStore.fetchMessages(wallet);
    const deliveredAt = new Date();

    if (messages.length > 0) {
      relayFetchCounter.inc(messages.length);
    }

    if (messages.length > 0) {
      const ids = messages.map((msg) => msg.id);
      await relayStore.markDelivered(wallet, ids);
    }

    try {
      const nowMs = Date.now();
      for (const msg of messages) {
      observeFetchLatency(msg, deliveredAt);
      const enq = msg?.timestamps?.enqueuedAt
        ? new Date(msg.timestamps.enqueuedAt).getTime()
        : new Date(msg.timestamps?.createdAt || deliveredAt).getTime();
      const latencyMs = Math.max(0, nowMs - enq);
      await safeLog(wallet, 'relay_delivered', { messageId: msg.id, latencyMs });
      }
    } catch (e) {
      // No bloquear por telemetría
    }

    const formatted = messages.map((msg) => ({
      id: msg.id,
      messageId: msg.id,
      from: msg.from,
      fromWallet: msg.from,
      sender: msg.from,
      senderWallet: msg.from,
      to: msg.to,
      toWallet: msg.to,
      recipient: msg.to,
      recipientWallet: msg.to,
      box: msg.box,
      boxSize: msg.boxSize,
      ...(msg.iv ? { iv: msg.iv } : {}),
      messageType: msg.messageType || 'text',
      status: 'delivered',
      createdAt: msg.timestamps?.createdAt || deliveredAt,
      enqueuedAt: msg.timestamps?.enqueuedAt || msg.timestamps?.createdAt || deliveredAt,
      deliveredAt,
      ...(msg.meta ? { meta: msg.meta } : {}),
      ...(msg.flags?.isUrgent ? { isUrgent: true } : {}),
      ...(msg.flags?.isEphemeral ? { isEphemeral: true } : {}),
      ...(msg.clientInfo?.platform ? { clientPlatform: msg.clientInfo.platform } : {}),
      ...(msg.networkInfo?.country ? { senderCountry: msg.networkInfo.country } : {}),
    }));

    if (messages.length > 0) {
      await safeLog(wallet, 'relay_fetch', { count: messages.length });
    }

    return res.status(200).json({ data: { messages: formatted } });
  } catch (err) {
    return res.status(500).json({ error: "FAILED_TO_FETCH", details: err?.message });
  }
};

/* ───────────────────────── /relay/ack ───────────────────────── */

export const ackMessages = async (req, res) => {
  try {
    if (!ENABLED) return res.status(503).json({ error: "relay-disabled" });
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: "unauthorized" });

    const { id, ids, ackIds } = req.body || {};
    let idsToAck = [];
    if (id) idsToAck = [String(id)];
    else if (Array.isArray(ids)) idsToAck = ids.map(String);
    else if (Array.isArray(ackIds)) idsToAck = ackIds.map(String);

    if (!idsToAck.length) {
      return res.status(400).json({ error: "INVALID_MESSAGE_ID", nextStep: "CHECK_INPUT" });
    }

    const relayStore = getRelayStore();
    const docs = await relayStore.findManyByIds(wallet, idsToAck);
    const totalBytes = docs.reduce((sum, doc) => sum + (doc.boxSize || 0), 0);

    const ackResult = await relayStore.ackMessages(wallet, idsToAck);
    const remainingBytes = await relayStore.recalcUsage(wallet);
    await User.updateOne({ wallet }, { $set: { relayUsedBytes: remainingBytes } });
    relayMailboxUsageGauge.labels(wallet).set(remainingBytes);

    try {
      const now = Date.now();
      for (const doc of docs) {
        const deliveredAt = doc?.timestamps?.deliveredAt
          ? new Date(doc.timestamps.deliveredAt).getTime()
          : null;
        if (deliveredAt) {
          const latencyMs = Math.max(0, now - deliveredAt);
          relayAckLatency.observe(latencyMs);
          await safeLog(wallet, 'relay_acked', { messageId: doc.id, latencyMs });
        }
      }
    } catch (e) {
      // No bloquear por telemetría
    }

    await safeLog(wallet, 'relay_ack', {
      count: ackResult.deletedCount || 0,
      freedBytes: ackResult.totalBytes || 0,
    });

    return res.status(200).json({
      message: "✅ Mensajes confirmados",
      deleted: ackResult.deletedCount || 0,
      freedBytes: ackResult.totalBytes || 0,
      nextStep: "NO_ACTION",
    });
  } catch (err) {
    return res.status(500).json({ error: "FAILED_TO_ACK", details: err?.message });
  }
};

/* ───────────────────────── /relay/policy ───────────────────────── */

export const getRelayPolicy = async (req, res) => {
  try {
    const u = req.user;
    if (!u?.wallet) return res.status(401).json({ error: "unauthorized" });

    return res.status(200).json({
      data: {
        tier: u.relayTier,
        perMessageCapBase64: MAX_BOX_BYTES,
        rawMaxForCap: cfg?.base64?.maxRawFor ? cfg.base64.maxRawFor(MAX_BOX_BYTES) : undefined,
        quotaBytes: u.relayQuotaBytes,
        usedBytes: u.relayUsedBytes,
        ttlSeconds: u.relayTTLSeconds,
        note: "El cap es sobre el tamaño BASE64; comprime antes de encolar.",
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "FAILED_TO_GET_POLICY", details: err?.message });
  }
};

/* ───────────────────────── /relay/config ───────────────────────── */

export const getRelayConfig = async (req, res) => {
  try {
    const wallet = req.user?.wallet;
    let tier = "basic";
    let overrides = null;

    if (wallet) {
      const u = await User.findOne(
        { wallet },
        { relayTier: 1, relayQuotaBytes: 1, relayTTLSeconds: 1, relayPerMessageMaxBytes: 1 }
      ).lean();

      if (u) {
        tier = u.relayTier || "basic";
        overrides = {
          quotaBytes: u.relayQuotaBytes ?? null,
          ttlSeconds: u.relayTTLSeconds ?? null,
          perMessageMaxBytes: u.relayPerMessageMaxBytes ?? null,
        };
      }
    }

    const tierKey = tier === 'basic' ? 'free' : tier;
    const planDefaults = config.tiers[tierKey] || config.tiers.free;

    return res.status(200).json({
      data: {
        tier,
        defaults: planDefaults,
        overrides,
        // Valor efectivo runtime (cfg), con fallback a config
        globalCapBytes: MAX_BOX_BYTES,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: "FAILED_TO_LOAD_RELAY_CONFIG" });
  }
};

/* ───────────────────────── /relay/usage ───────────────────────── */

export const getRelayUsage = async (req, res) => {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: "unauthorized" });

    const u = await User.findOne(
      { wallet },
      { relayTier: 1, relayQuotaBytes: 1, relayUsedBytes: 1, relayTTLSeconds: 1 }
    ).lean();

    const tier = u?.relayTier || "free";
    const tierKey = tier === 'basic' ? 'free' : tier;
    const quota = u?.relayQuotaBytes ?? (config.tiers[tierKey]?.quotaBytes ?? config.tiers.free.quotaBytes);
    const used  = u?.relayUsedBytes ?? 0;
    const ttl   = u?.relayTTLSeconds ?? (config.tiers[tierKey]?.ttlSeconds ?? config.tiers.free.ttlSeconds);
    const free  = Math.max(0, quota - used);

    return res.status(200).json({ data: { tier, quotaBytes: quota, usedBytes: used, freeBytes: free, ttlSeconds: ttl } });
  } catch (error) {
    return res.status(500).json({ error: "FAILED_TO_GET_USAGE", details: error.message });
  }
};

/* ───────────────────────── /relay/purge ───────────────────────── */

export const purgeRelayMailbox = async (req, res) => {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: "unauthorized" });

    const relayStore = getRelayStore();
    const purgeResult = await relayStore.purgeMailbox(wallet);
    const remainBytes = await relayStore.recalcUsage(wallet);
    await User.updateOne({ wallet }, { $set: { relayUsedBytes: remainBytes } });

    try {
      await safeLog(wallet, 'relay_purged_manual', {
        count: purgeResult.deleted,
        freedBytes: purgeResult.freedBytes,
      });
    } catch {}

    return res.status(200).json({
      data: {
        ok: true,
        messagesDeleted: purgeResult.deleted,
        bytesFreed: purgeResult.freedBytes,
        usedBytesNow: remainBytes,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "FAILED_TO_PURGE", details: error.message });
  }
};

async function safeLog(userId, eventType, data) {
  try {
    if (!userId) return;
    await logEvent(userId, eventType, data);
  } catch (error) {
    log.warn('stats_log_failed', {
      userId,
      eventType,
      error: error?.message || error,
    });
  }
}
