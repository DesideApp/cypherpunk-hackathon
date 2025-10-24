import User from "#modules/users/models/user.model.js";
import Contact from "#modules/contacts/models/contact.model.js";
import { ContactStatus } from "#modules/contacts/contact.constants.js";
import RelayMessage from "../models/relayMessage.model.js";
import { io as ioExport, isWalletOnlineWithTTL } from "#shared/services/websocketServer.js";
import cfg from "#config/runtimeConfig.js";
import config from "#config/appConfig.js";
import logEvent from '#modules/stats/services/eventLogger.service.js';

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
    console.warn(`[Relay] contact check skipped: ${e?.message || e}`);
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

    // Cuotas (DESTINO)
    const quota    = recipientUser.relayQuotaBytes ?? config.tiers.basic.quotaBytes;
    const used     = recipientUser.relayUsedBytes  ?? 0;
    const gracePct = recipientUser.relayOverflowGracePct ?? 0;
    const allowedWithGrace = Math.floor(quota * (1 + gracePct / 100));

    const normalizedMsgId = String(msgId);
    let targetDoc = await RelayMessage.findById(normalizedMsgId).lean();

    if (!targetDoc && agreementId) {
      targetDoc = await RelayMessage.findOne({ to: dest, 'meta.agreementId': agreementId }).lean();
    }

    const targetId = String(targetDoc?._id || normalizedMsgId);
    const previousBoxSize = targetDoc?.boxSize || 0;
    const willUse = targetDoc ? (used - previousBoxSize + boxSize) : used + boxSize;

    const finalMeta = meta ? { ...meta } : null;
    if (finalMeta && !finalMeta.clientId) {
      finalMeta.clientId = targetDoc?.meta?.clientId || targetId;
    }

    if (willUse > allowedWithGrace) {
      try { await safeLog(sender, 'relay_error', { code: 'quota_exceeded', to: dest, quotaBytes: quota, usedBytes: used, incomingBytes: boxSize, allowedMaxBytes: allowedWithGrace, gracePct }); } catch {}
      return res.status(409).json({
        error: "relay-quota-exceeded",
        nextStep: "MANAGE_RELAY",
        details: { quotaBytes: quota, usedBytes: used, incomingBytes: boxSize, gracePct, allowedMaxBytes: allowedWithGrace },
      });
    }

    // Idempotente: upsert por _id = msgId (sin conflictos de paths)
    const updatePayload = {
      $set: {
        to: dest,
        from: sender,
        box,
        boxSize,
        iv: iv ?? null,
        messageType,
        meta: finalMeta,
      },
    };

    if (!targetDoc) {
      updatePayload.$setOnInsert = { _id: targetId, createdAt: new Date() };
    }

    const result = await RelayMessage.updateOne({ _id: targetId }, updatePayload, { upsert: true });

    // Incrementa uso sólo si NO existía previamente
    if (!targetDoc) {
      await User.updateOne({ wallet: dest }, { $inc: { relayUsedBytes: boxSize } });
    } else {
      const delta = boxSize - previousBoxSize;
      if (delta !== 0) {
        await User.updateOne({ wallet: dest }, { $inc: { relayUsedBytes: delta } });
      }
    }

    // Notificar al receptor si está online y la política lo permite
    if (recipientOnline && !OFFLINE_ONLY) {
      ioInstance?.to?.(dest)?.emit?.("relay:flush", [targetId]);
    }

    try {
      if (isForced) await safeLog(sender, 'relay_forced_offline', { to: dest });
      await safeLog(sender, 'relay_message', { to: dest, bytes: boxSize, recipientOnline: !!recipientOnline, forced: !!isForced });
    } catch {}

    const nowUsed = willUse;
    const isOverflow = nowUsed > quota && nowUsed <= allowedWithGrace;

    return res.status(202).json({
      status: "queued",
      transport: "relay",
      messageId: targetId,
      ...(isForced ? { forced: true } : {}),
      ...(isOverflow ? { warning: "relay-overflow-grace", quotaBytes: quota, usedBytes: nowUsed, gracePct } : {}),
    });
  } catch (err) {
    // No dejes que el logging cause otro 500; y escribe el motivo real en logs del server
    console.error("[Relay] enqueue error:", err);
    return res.status(500).json({ error: "FAILED_TO_SEND", code: "UNEXPECTED", details: err?.message || "unknown" });
  }
};

/* ───────────────────────── /relay/fetch ───────────────────────── */

export const fetchMessages = async (req, res) => {
  try {
    if (!ENABLED) return res.status(503).json({ error: "relay-disabled" });
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: "unauthorized" });

    const messages = await RelayMessage.find({ to: wallet }).sort({ createdAt: 1 }).lean(); // FIFO
    
    // Marcar mensajes como entregados
    if (messages.length > 0) {
      const messageIds = messages.map(m => m._id);
      await RelayMessage.updateMany(
        { _id: { $in: messageIds }, status: { $ne: 'acknowledged' } },
        { 
          $set: { 
            status: 'delivered',
            'timestamps.deliveredAt': new Date()
          }
        }
      );
    }
    
    // Instrumentación: latencia de entrega (enqueuedAt -> deliveredAt)
    try {
      const now = Date.now();
      for (const msg of messages) {
        const enq = msg?.timestamps?.enqueuedAt ? new Date(msg.timestamps.enqueuedAt).getTime() : new Date(msg.createdAt).getTime();
        const latencyMs = Math.max(0, now - enq);
        await safeLog(wallet, 'relay_delivered', { messageId: String(msg._id), latencyMs });
      }
    } catch (e) {
      // No bloquear por telemetría
    }
    
    const formatted = messages.map((msg) => ({
      // IDs y referencias
      id: String(msg._id),
      messageId: String(msg._id),
      
      // Participantes (compatibilidad con múltiples formatos del frontend)
      from: msg.from,
      fromWallet: msg.from,
      sender: msg.from,
      senderWallet: msg.from,
      to: msg.to,
      toWallet: msg.to,
      recipient: msg.to,
      recipientWallet: msg.to,
      
      // Contenido cifrado
      box: msg.box,
      boxSize: msg.boxSize,
      ...(msg.iv ? { iv: msg.iv } : {}),
      
      // Metadatos adicionales (con fallbacks para mensajes antiguos)
      messageType: msg.messageType || 'text',
      status: 'delivered', // siempre delivered después del fetch
      
      // Timestamps
      createdAt: msg.createdAt,
      enqueuedAt: msg.timestamps?.enqueuedAt || msg.createdAt,
      deliveredAt: new Date(), // se marca como entregado al hacer fetch
      
      // Información adicional si existe
      ...(msg.conversation?.threadId ? { threadId: msg.conversation.threadId } : {}),
      ...(msg.conversation?.replyToId ? { replyToId: msg.conversation.replyToId } : {}),
      ...(msg.flags?.isUrgent ? { isUrgent: true } : {}),
      ...(msg.flags?.isEphemeral ? { isEphemeral: true } : {}),
      ...(msg.meta ? { meta: msg.meta } : {}),
      
      // Cliente y red (si existe)
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

    const docs = await RelayMessage.find(
      { _id: { $in: idsToAck }, to: String(wallet) }, 
      { boxSize: 1, createdAt: 1, 'timestamps.enqueuedAt': 1, 'timestamps.deliveredAt': 1 }
    ).lean();
    const totalBytes = docs.reduce((sum, d) => sum + (d.boxSize || 0), 0);

    // Marcar como acknowledged antes de eliminar (para auditoría)
    await RelayMessage.updateMany(
      { _id: { $in: idsToAck }, to: String(wallet) },
      { 
        $set: { 
          status: 'acknowledged',
          'timestamps.acknowledgedAt': new Date()
        }
      }
    );

    // Instrumentación: latencia de ACK (deliveredAt -> acknowledgedAt)
    try {
      const now = Date.now();
      for (const d of docs) {
        const deliveredAt = d?.timestamps?.deliveredAt ? new Date(d.timestamps.deliveredAt).getTime() : null;
        if (deliveredAt) {
          const latencyMs = Math.max(0, now - deliveredAt);
          await safeLog(wallet, 'relay_acked', { messageId: String(d._id), latencyMs });
        }
      }
    } catch (e) {
      // No bloquear por telemetría
    }

    // Eliminar los mensajes después de marcar como acknowledged
    const result = await RelayMessage.deleteMany({ _id: { $in: idsToAck }, to: String(wallet) });

    if (totalBytes > 0) {
      await User.updateOne({ wallet }, { $inc: { relayUsedBytes: -totalBytes } });
    }

    await safeLog(wallet, 'relay_ack', { count: result.deletedCount || 0, freedBytes: totalBytes || 0 });

    return res.status(200).json({
      message: "✅ Mensajes confirmados",
      deleted: result.deletedCount || 0,
      freedBytes: totalBytes || 0,
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

    const planDefaults = config.tiers[tier] || config.tiers.basic;

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

    const tier = u?.relayTier || "basic";
    const quota = u?.relayQuotaBytes ?? (config.tiers[tier]?.quotaBytes ?? config.tiers.basic.quotaBytes);
    const used  = u?.relayUsedBytes ?? 0;
    const ttl   = u?.relayTTLSeconds ?? (config.tiers[tier]?.ttlSeconds ?? config.tiers.basic.ttlSeconds);
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

    const docs = await RelayMessage.find({ to: wallet }, { boxSize: 1 }).lean();
    if (docs.length === 0) {
      return res.status(200).json({ data: { ok: true, messagesDeleted: 0, bytesFreed: 0 } });
    }

    const bytesFreed = docs.reduce((sum, d) => sum + (d.boxSize || 0), 0);

    await RelayMessage.deleteMany({ to: wallet });
    if (bytesFreed > 0) {
      await User.updateOne({ wallet }, { $inc: { relayUsedBytes: -bytesFreed } });
    }
    try { await safeLog(wallet, 'relay_purged_manual', { count: docs.length, freedBytes: bytesFreed }); } catch {}
    return res.status(200).json({ data: { ok: true, messagesDeleted: docs.length, bytesFreed } });
  } catch (error) {
    return res.status(500).json({ error: "FAILED_TO_PURGE", details: error.message });
  }
};

async function safeLog(userId, eventType, data) {
  try {
    if (!userId) return;
    await logEvent(userId, eventType, data);
  } catch (error) {
    console.warn(`[Relay] Failed to log ${eventType}: ${error.message}`);
  }
}
