import User from "#modules/users/models/user.model.js";
import Contact from "#modules/contacts/models/contact.model.js";
import { ContactStatus } from "#modules/contacts/contact.constants.js";
import { io as ioExport, isWalletOnlineWithTTL } from "#shared/services/websocketServer.js";
import cfg from "#config/runtimeConfig.js";
import config from "#config/appConfig.js";
import logEvent from '#modules/stats/services/eventLogger.service.js';
import { createModuleLogger } from '#config/logger.js';
import { appendMessageToHistory } from '#modules/history/services/history.service.js';
import ConversationMessage from '#modules/history/models/message.model.js';
import { getRelayStore } from '#modules/relay/services/relayStoreProvider.js';
import { resolveQuota, checkQuota, applyQuota } from '#modules/relay/services/quota.service.js';
import computeUsageStatus from '#modules/relay/services/usageStatus.js';
import {
  relayFetchCounter,
  observeFetchLatency,
  relayAckLatency,
  relayMailboxUsageGauge,
  relayMailboxUsageRatioGauge,
  recordHistorySyncAttempt,
  recordHistorySyncSuccess,
  recordHistorySyncFailure,
} from '#modules/relay/services/relayMetrics.js';
import {
  logActionSend,
  logActionRequestCreated,
} from '#modules/actions/services/actionEvents.service.js';
import {
  shouldBlock as shouldBlockAbuse,
  recordAbuseEvent,
  getAbuseSnapshot,
  unblockEntity,
} from '#modules/relay/services/relayAbuse.service.js';
import { deleteObject } from '#modules/attachments/services/r2Storage.js';
import {
  vaultPurgeCounter,
  vaultUsageGauge,
} from '#modules/attachments/services/attachmentMetrics.js';

const log = createModuleLogger({ module: 'relay.controller' });

const MAX_BOX_BYTES = (cfg?.relay?.maxBoxBytes ?? config.relayMaxBoxBytes);
const OFFLINE_ONLY  = (cfg?.relay?.offlineOnly ?? config.relayOfflineOnly);
const ENABLED       = (cfg?.relay?.enabled ?? config.relayEnabled);

const bLen = (s) => Buffer.byteLength(s || "", "utf8");
const SOLANA_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ───────────────────────── helpers ───────────────────────── */

function respondWithAbuseBlock(req, res, block) {
  if (!block) return false;
  if (Number.isFinite(block.retryAfterSeconds) && block.retryAfterSeconds > 0) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(block.retryAfterSeconds))));
  }
  log.warn('relay_abuse_block_response', {
    wallet: req.user?.wallet || null,
    ip: req.ip,
    reason: block.reason || 'abuse',
    retryAfterSeconds: block.retryAfterSeconds ?? null,
  });
  res.status(429).json({
    error: 'temporarily_blocked',
    detail: {
      reason: block.reason || 'abuse',
      retryAfterSeconds: block.retryAfterSeconds ?? null,
    },
  });
  return true;
}

function getTierDefinition(tierName) {
  const key = tierName === 'basic' ? 'free' : tierName;
  return config.tiers[key] || config.tiers.free;
}

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

function normalizePurgeFraction(value) {
  if (value == null) return 1;
  let fraction = null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) fraction = null;
    else if (trimmed.endsWith('%')) {
      const num = Number(trimmed.slice(0, -1));
      if (Number.isFinite(num)) fraction = num / 100;
    } else {
      fraction = Number(trimmed);
    }
  } else {
    fraction = Number(value);
  }
  if (!Number.isFinite(fraction) || fraction <= 0) return 1;
  if (fraction >= 1) return 1;
  if (fraction >= 0.5) return 0.5;
  return 0.25;
}

function normalizePurgeTarget(value) {
  const target = typeof value === 'string' ? value.trim().toLowerCase() : 'relay';
  if (target === 'vault') return 'vault';
  if (target === 'both') return 'both';
  return 'relay';
}

function escapeRegex(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function buildAttachmentKeyRegex(wallet) {
  return new RegExp(`^${escapeRegex(wallet)}/`);
}

async function purgeRelayPortion(relayStore, wallet, fraction) {
  const stats = await relayStore.purgeMailboxFraction(wallet, fraction);
  const remainBytes = await relayStore.recalcUsage(wallet);
  await User.updateOne({ wallet }, { $set: { relayUsedBytes: remainBytes } });
  return {
    messagesDeleted: stats?.deleted ?? 0,
    bytesFreed: stats?.freedBytes ?? 0,
    usedBytesNow: remainBytes,
  };
}

async function purgeVaultPortion(wallet, fraction) {
  const user = await User.findOne({ wallet }, { vaultUsedBytes: 1 }).lean();
  const currentUsage = Math.max(0, Number(user?.vaultUsedBytes) || 0);
  if (currentUsage <= 0) {
    return { attachmentsDeleted: 0, freedBytes: 0, vaultUsedBytes: 0 };
  }

  const targetBytes = fraction >= 0.999
    ? currentUsage
    : Math.max(1, Math.floor(currentUsage * fraction));

  const keyRegex = buildAttachmentKeyRegex(wallet);
  const pipeline = [
    { $match: { 'attachments.0': { $exists: true }, participants: wallet } },
    { $project: { attachments: 1, createdAt: 1 } },
    { $unwind: '$attachments' },
    { $match: { 'attachments.key': keyRegex } },
    {
      $addFields: {
        attachmentCreatedAt: {
          $ifNull: ['$attachments.createdAt', '$createdAt'],
        },
      },
    },
    { $sort: { attachmentCreatedAt: 1, _id: 1 } },
    { $project: { messageId: '$_id', attachment: '$attachments' } },
  ];

  const cursor = ConversationMessage.aggregate(pipeline)
    .option({ allowDiskUse: true })
    .cursor({ batchSize: 200 });
  const toRemove = [];
  let accumulated = 0;
  for await (const doc of cursor) {
    const attachment = doc?.attachment;
    if (!attachment?.key) continue;
    const size = Number(attachment.sizeBytes) || 0;
    toRemove.push({
      messageId: doc.messageId,
      key: attachment.key,
      sizeBytes: size,
    });
    accumulated += size;
    if (fraction < 0.999 && accumulated >= targetBytes) {
      break;
    }
  }

  if (!toRemove.length) {
    return { attachmentsDeleted: 0, freedBytes: 0, vaultUsedBytes: currentUsage };
  }

  const grouped = new Map();
  toRemove.forEach((entry) => {
    if (!grouped.has(entry.messageId)) grouped.set(entry.messageId, []);
    grouped.get(entry.messageId).push(entry.key);
  });

  for (const [messageId, keys] of grouped.entries()) {
    try {
      await ConversationMessage.updateOne(
        { _id: messageId },
        { $pull: { attachments: { key: { $in: keys } } } }
      );
    } catch (error) {
      log.warn('vault_purge_message_update_failed', {
        messageId,
        error: error?.message || error,
      });
    }
  }

  for (const entry of toRemove) {
    if (!entry.key) continue;
    try {
      await deleteObject({ key: entry.key });
      vaultPurgeCounter.inc({ reason: 'manual' });
    } catch (error) {
      log.warn('vault_purge_object_delete_failed', {
        key: entry.key,
        error: error?.message || error,
      });
    }
  }

  const freedBytes = toRemove.reduce((sum, entry) => sum + (entry.sizeBytes || 0), 0);
  const newUsage = Math.max(0, currentUsage - freedBytes);
  await User.updateOne({ wallet }, { $set: { vaultUsedBytes: newUsage } });
  vaultUsageGauge.labels(wallet).set(newUsage);

  return {
    attachmentsDeleted: toRemove.length,
    freedBytes,
    vaultUsedBytes: newUsage,
  };
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
    const { msgId, to, box, iv, force, meta: rawMeta, attachments: rawAttachments } = req.body || {};
    if (!sender) return res.status(401).json({ error: "unauthorized" });

    if (respondWithAbuseBlock(req, res, shouldBlockAbuse({ scope: 'wallet', id: sender }))) {
      return;
    }

    // Validaciones de forma
    const dest = String(to || "").trim();
    if (!dest || dest === sender || !SOLANA_PUBKEY.test(dest)) {
      recordAbuseEvent({ scope: 'wallet', id: sender, reason: 'invalid_pubkey' });
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
      recordAbuseEvent({ scope: 'wallet', id: sender, reason: 'forbidden_not_contact' });
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
    const attachments = Array.isArray(rawAttachments) ? rawAttachments : undefined;

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

    try {
      relayMailboxUsageGauge.labels(dest).set(nowUsed);
      const { ratio: usageRatio, status: usageStatus } = computeUsageStatus(
        nowUsed,
        quotaCtx.quotaBytes,
        quotaCtx.warningRatio,
        quotaCtx.criticalRatio
      );
      relayMailboxUsageRatioGauge.labels(dest).set(usageRatio);
      if (usageStatus !== 'ok') {
        await safeLog(dest, usageStatus === 'critical' ? 'relay_usage_critical' : 'relay_usage_warning', {
          quotaBytes: quotaCtx.quotaBytes,
          usedBytes: nowUsed,
          ratio: usageRatio,
          threshold: usageStatus === 'critical' ? quotaCtx.criticalRatio : quotaCtx.warningRatio,
          sender,
        });
      }
    } catch (usageLogErr) {
      log.warn('usage_update_failed', {
        wallet: dest,
        error: usageLogErr?.message || usageLogErr,
      });
    }

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

      if (finalMeta?.kind === 'blink-action') {
        const blinkKind = (finalMeta?.blinkKind || '').toLowerCase();
        if (blinkKind === 'transfer' || blinkKind === 'send' || blinkKind === 'transfer-send') {
          await logActionSend({
            actor: sender,
            to: dest,
            amount: finalMeta?.amount ?? null,
            token: finalMeta?.token || null,
            source: finalMeta?.source || null,
            txSig: finalMeta?.txSig || null,
            convId: finalMeta?.convId || null,
          });
        }
      } else if (finalMeta?.kind === 'payment-request') {
        await logActionRequestCreated({
          actor: sender,
          to: dest,
          amount: finalMeta?.amount ?? null,
          token: finalMeta?.token || null,
          note: finalMeta?.note || null,
          actionUrl: finalMeta?.actionUrl || null,
        });
      }
    } catch {}

    try {
      recordHistorySyncAttempt('relay');
      const historyResult = await appendMessageToHistory({
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
        attachments,
      });
      recordHistorySyncSuccess('relay', historyResult?.existing);
    } catch (historyErr) {
      const reason =
        typeof historyErr?.code === 'string' ? historyErr.code :
        typeof historyErr?.name === 'string' ? historyErr.name :
        (historyErr?.message && historyErr.message.includes('duplicate')) ? 'duplicate' :
        'exception';
      recordHistorySyncFailure('relay', reason);
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
      const quotaUser = await User.findOne(
        { wallet },
        { relayQuotaBytes: 1, relayTier: 1 }
      ).lean();
      const tierDef = getTierDefinition(quotaUser?.relayTier || 'free');
      const quotaBytes = Number.isFinite(quotaUser?.relayQuotaBytes)
        ? quotaUser.relayQuotaBytes
        : tierDef.quotaBytes;
      const { ratio: ackRatio } = computeUsageStatus(
        remainingBytes,
        quotaBytes,
        Number.isFinite(tierDef.warningRatio) ? tierDef.warningRatio : config.relayWarningRatio,
        Number.isFinite(tierDef.criticalRatio) ? tierDef.criticalRatio : config.relayCriticalRatio
      );
      relayMailboxUsageRatioGauge.labels(wallet).set(ackRatio);
    } catch (ratioErr) {
      log.warn('usage_ratio_update_failed', {
        wallet,
        error: ratioErr?.message || ratioErr,
      });
    }

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
    const tierDef = getTierDefinition(tier);
    const quota = Number.isFinite(u?.relayQuotaBytes) ? u.relayQuotaBytes : tierDef.quotaBytes;
    const used  = u?.relayUsedBytes ?? 0;
    const ttl   = Number.isFinite(u?.relayTTLSeconds) ? u.relayTTLSeconds : tierDef.ttlSeconds;
    const free  = Math.max(0, quota - used);
    const warningRatio = Number.isFinite(tierDef.warningRatio) ? tierDef.warningRatio : config.relayWarningRatio;
    const criticalRatio = Number.isFinite(tierDef.criticalRatio) ? tierDef.criticalRatio : config.relayCriticalRatio;
    const overflowGracePct = Number.isFinite(u?.relayOverflowGracePct)
      ? u.relayOverflowGracePct
      : Number.isFinite(tierDef.overflowGracePct)
        ? tierDef.overflowGracePct
        : 0;
    const graceLimitBytes = Math.floor(quota * (1 + Math.max(0, overflowGracePct) / 100));
    const graceRemainingBytes = Math.max(0, graceLimitBytes - used);
    const graceExceededBytes = Math.max(0, used - quota);
    const { ratio: usageRatio, status: usageStatus } = computeUsageStatus(used, quota, warningRatio, criticalRatio);

    const vaultQuota = Number.isFinite(u?.vaultQuotaBytes) ? u.vaultQuotaBytes : tierDef.vaultQuotaBytes;
    const vaultUsed = Number.isFinite(u?.vaultUsedBytes) ? u.vaultUsedBytes : 0;
    const vaultFree = Math.max(0, vaultQuota - vaultUsed);
    const vaultTtl = Number.isFinite(u?.vaultTTLSeconds) ? u.vaultTTLSeconds : tierDef.vaultTtlSeconds;
    const { ratio: vaultUsageRatio, status: vaultUsageStatus } = computeUsageStatus(
      vaultUsed,
      vaultQuota,
      warningRatio,
      criticalRatio,
    );

    const relayOverflow = used > quota;
    const vaultOverflow = vaultUsed > vaultQuota;
    const isInGrace = relayOverflow || vaultOverflow;
    const graceReason = !isInGrace
      ? 'none'
      : relayOverflow && vaultOverflow
        ? 'both'
        : relayOverflow
          ? 'relay'
          : 'vault';

    return res.status(200).json({
      data: {
        tier,
        quotaBytes: quota,
        usedBytes: used,
        freeBytes: free,
        ttlSeconds: ttl,
        usageRatio,
        usageStatus,
        warningRatio,
        criticalRatio,
        grace: {
          enabled: overflowGracePct > 0,
          percentage: overflowGracePct,
          limitBytes: graceLimitBytes,
          remainingBytes: graceRemainingBytes,
          exceededBytes: graceExceededBytes,
          isInGrace,
          reason: graceReason,
          vaultOverflowBytes: Math.max(0, vaultUsed - vaultQuota),
        },
        vault: {
          quotaBytes: vaultQuota,
          usedBytes: vaultUsed,
          freeBytes: vaultFree,
          ttlSeconds: vaultTtl,
          usageRatio: vaultUsageRatio,
          usageStatus: vaultUsageStatus,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "FAILED_TO_GET_USAGE", details: error.message });
  }
};

/* ───────────────────────── /relay/purge ───────────────────────── */

export const purgeRelayMailbox = async (req, res) => {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: "unauthorized" });

    const target = normalizePurgeTarget(req.body?.target);
    const fraction = normalizePurgeFraction(req.body?.fraction);

    const relayStore = getRelayStore();
    const response = {
      target,
      fraction,
      relay: null,
      vault: null,
    };

    if (target === 'relay' || target === 'both') {
      response.relay = await purgeRelayPortion(relayStore, wallet, fraction);
    }

    if (target === 'vault' || target === 'both') {
      response.vault = await purgeVaultPortion(wallet, fraction);
    }

    try {
      await safeLog(wallet, 'relay_purged_manual', {
        target,
        fraction,
        relayDeleted: response.relay?.messagesDeleted ?? 0,
        relayFreedBytes: response.relay?.bytesFreed ?? 0,
        vaultFreedBytes: response.vault?.freedBytes ?? 0,
      });
    } catch {}

    return res.status(200).json({
      data: response,
    });
  } catch (error) {
    return res.status(500).json({ error: "FAILED_TO_PURGE", details: error.message });
  }
};

/* ───────────────────────── Admin endpoints ───────────────────────── */

export const listRelayAbuseFlags = async (req, res) => {
  try {
    const snapshot = getAbuseSnapshot();
    return res.status(200).json({
      data: snapshot.map((entry) => ({
        scope: entry.scope,
        id: entry.id,
        block: entry.block
          ? {
              reason: entry.block.reason,
              until: entry.block.until,
            }
          : null,
        reasons: entry.reasons,
      })),
    });
  } catch (error) {
    log.error('relay_abuse_snapshot_failed', { error: error?.message || error });
    return res.status(500).json({ error: 'failed_to_list_abuse_flags' });
  }
};

export const unblockRelayEntity = async (req, res) => {
  try {
    const scope = (req.body?.scope || 'wallet').trim().toLowerCase();
    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : null;
    if (!id) {
      return res.status(400).json({ error: 'invalid_payload', detail: 'id_required' });
    }
    const validScope = scope === 'ip' ? 'ip' : 'wallet';
    const removed = unblockEntity({ scope: validScope, id });
    if (!removed) {
      return res.status(404).json({ error: 'not_found' });
    }
    log.info('relay_abuse_manual_unblock', {
      admin: req.user?.wallet || null,
      scope: validScope,
      id,
    });
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    log.error('relay_abuse_unblock_failed', { error: error?.message || error });
    return res.status(500).json({ error: 'failed_to_unblock' });
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
