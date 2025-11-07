import Conversation from '../models/conversation.model.js';
import ConversationMessage from '../models/message.model.js';
import User from '#modules/users/models/user.model.js';
import config from '#config/appConfig.js';
import logger, { createModuleLogger } from '#config/logger.js';
import { vaultUsageGauge } from '#modules/attachments/services/attachmentMetrics.js';
import {
  recordMessageWritten,
  recordMessageDuplicate,
  recordMessageFailed,
} from './historyMetrics.js';

const log = createModuleLogger({ module: 'history.service' });

function normalizeWallet(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeParticipants(raw) {
  const set = new Set();
  for (const val of Array.isArray(raw) ? raw : []) {
    const wallet = normalizeWallet(val);
    if (wallet) set.add(wallet);
  }
  return Array.from(set).sort();
}

export function computeConversationId(participants) {
  return normalizeParticipants(participants).join('__');
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (!parsed) return null;
    return parsed;
  } catch (err) {
    log.warn('history_cursor_decode_failed', {
      error: err?.message || err,
    });
    return null;
  }
}

export async function appendMessageToHistory({
  convId,
  participants,
  sender,
  relayMessageId,
  clientMsgId,
  source = 'relay',
  messageId,
  box,
  boxSize,
  iv,
  messageType = 'text',
  meta,
  createdAt = new Date(),
  timestamps,
  attachments,
}) {
  if (!relayMessageId && !(typeof messageId === 'string' && messageId.trim())) {
    throw new Error('appendMessageToHistory requires relayMessageId or messageId');
  }
  const normalizedParticipants = normalizeParticipants(participants);
  if (normalizedParticipants.length < 2) {
    throw new Error('appendMessageToHistory needs at least two participants');
  }
  if (!normalizedParticipants.includes(sender)) {
    normalizedParticipants.push(sender);
    normalizedParticipants.sort();
  }

  const conversationId = convId || computeConversationId(normalizedParticipants);

  const normalizedSource = typeof source === 'string' && source.trim() ? source.trim().toLowerCase() : 'relay';
  const normalizedMessageId = typeof messageId === 'string' && messageId.trim() ? messageId.trim() : null;

  let existing = null;
  if (normalizedSource && normalizedMessageId) {
    existing = await ConversationMessage.findOne({ source: normalizedSource, messageId: normalizedMessageId }).lean();
  }
  if (!existing) {
    existing = await ConversationMessage.findOne({ relayMessageId }).lean();
  }
  if (existing) {
    logger.debug('[history] duplicate append skipped', {
      convId: existing.convId,
      seq: existing.seq,
      source: existing.source || normalizedSource || 'relay',
      relayMessageId,
      messageId: normalizedMessageId,
    });
    recordMessageDuplicate(existing.source || normalizedSource || 'relay');
    return { convId: existing.convId, seq: existing.seq, existing: true };
  }

  const now = createdAt instanceof Date ? createdAt : new Date(createdAt);

  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId },
    {
      $setOnInsert: {
        _id: conversationId,
        participants: normalizedParticipants,
        members: normalizedParticipants.map(wallet => ({
          wallet,
          joinedAt: now,
          lastReadSeq: wallet === sender ? 0 : 0,
          lastReadAt: wallet === sender ? now : null,
        })),
        createdAt: now,
      },
      $set: {
        participants: normalizedParticipants,
        updatedAt: now,
      },
      $inc: { seqMax: 1, messageCount: 1 },
    },
    { upsert: true, new: true }
  );

  const seq = conversation.seqMax;

  const missingMembers = normalizedParticipants.filter(wallet => !conversation.members?.some(m => m.wallet === wallet));
  if (missingMembers.length) {
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $push: {
          members: {
            $each: missingMembers.map(wallet => ({
              wallet,
              joinedAt: now,
              lastReadSeq: wallet === sender ? seq : 0,
              lastReadAt: wallet === sender ? now : null,
            })),
          },
        },
      }
    ).catch(err =>
      log.warn('history_add_member_failed', {
        convId: conversationId,
        missingMembers,
        error: err?.message || err,
      })
    );
  }

  let normalizedAttachments = undefined;
  if (Array.isArray(attachments) && attachments.length) {
    normalizedAttachments = attachments
      .map(att => {
        const key = typeof att?.key === 'string' ? att.key.trim() : '';
        const bucket = typeof att?.bucket === 'string' && att.bucket.trim()
          ? att.bucket.trim()
          : config.attachmentVault.bucket;
        const mimeType = typeof att?.mimeType === 'string' && att.mimeType.trim()
          ? att.mimeType.trim()
          : 'application/octet-stream';
        const sizeBytes = Number.isFinite(att?.sizeBytes) ? att.sizeBytes : parseInt(att?.sizeBytes ?? 0, 10) || 0;
        if (!key || !bucket) return null;
        const normalized = {
          key,
          bucket,
          mimeType,
          sizeBytes: Math.max(0, sizeBytes),
          hash: typeof att?.hash === 'string' && att.hash.trim() ? att.hash.trim() : null,
          thumbnailKey: typeof att?.thumbnailKey === 'string' && att.thumbnailKey.trim() ? att.thumbnailKey.trim() : null,
          expiresAt: att?.expiresAt ? new Date(att.expiresAt) : null,
          createdAt: att?.createdAt ? new Date(att.createdAt) : now,
        };
        return normalized;
      })
      .filter(Boolean);
    if (!normalizedAttachments.length) {
      normalizedAttachments = undefined;
    }
  }

  const messagePayload = {
    convId: conversationId,
    seq,
    sender,
    source: normalizedSource,
    messageId: normalizedMessageId,
    participants: normalizedParticipants,
    relayMessageId,
    box,
    boxSize,
    iv: iv ?? null,
    messageType,
    meta: meta && typeof meta === 'object' ? meta : undefined,
    createdAt: now,
    updatedAt: now,
  };
  if (clientMsgId) messagePayload.clientMsgId = clientMsgId;
  if (timestamps && typeof timestamps === 'object') {
    messagePayload.timestamps = {};
    if (timestamps.deliveredAt) {
      messagePayload.timestamps.deliveredAt = timestamps.deliveredAt instanceof Date
        ? timestamps.deliveredAt
        : new Date(timestamps.deliveredAt);
    }
    if (timestamps.acknowledgedAt) {
      messagePayload.timestamps.acknowledgedAt = timestamps.acknowledgedAt instanceof Date
        ? timestamps.acknowledgedAt
        : new Date(timestamps.acknowledgedAt);
    }
    if (!Object.keys(messagePayload.timestamps).length) {
      delete messagePayload.timestamps;
    }
  }
  if (normalizedAttachments) messagePayload.attachments = normalizedAttachments;

  try {
    await ConversationMessage.create(messagePayload);
    logger.debug('[history] message appended', {
      convId: conversationId,
      seq,
      source: normalizedSource,
      relayMessageId,
      messageId: normalizedMessageId,
    });
    recordMessageWritten(normalizedSource || 'relay');
    if (normalizedAttachments?.length) {
      const totalAttachmentBytes = normalizedAttachments.reduce((sum, att) => sum + (att.sizeBytes || 0), 0);
      if (totalAttachmentBytes > 0) {
        const updatedUser = await User.findOneAndUpdate(
          { wallet: sender },
          { $inc: { vaultUsedBytes: totalAttachmentBytes } },
          { new: true }
        ).lean().catch(err => {
          log.warn('history_vault_usage_update_failed', {
            wallet: sender,
            bytes: totalAttachmentBytes,
            error: err?.message || err,
          });
          return null;
        });

        if (updatedUser) {
          const usage = Math.max(0, Number(updatedUser.vaultUsedBytes) || 0);
          try {
            vaultUsageGauge.labels(sender).set(usage);
          } catch (metricErr) {
            log.warn('history_vault_usage_metric_failed', {
              wallet: sender,
              error: metricErr?.message || metricErr,
            });
          }
        }
      }
    }
  } catch (err) {
    if (err?.code === 11000) {
      recordMessageDuplicate(normalizedSource || 'relay');
      return { convId: conversationId, seq, existing: true };
    }
    // revert counters if insert fails
    await Conversation.updateOne(
      { _id: conversationId },
      { $inc: { seqMax: -1, messageCount: -1 } }
    ).catch(e =>
      log.warn('history_rollback_failed', {
        convId: conversationId,
        error: e?.message || e,
      })
    );
    log.error('history_message_insert_failed', {
      convId: conversationId,
      relayMessageId,
      error: err?.message || err,
    });
    recordMessageFailed(normalizedSource || 'relay', err?.code || err?.name || 'write_error');
    throw err;
  }

  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessage: {
          seq,
          sender,
          relayMessageId,
          source: normalizedSource,
          messageId: normalizedMessageId,
          messageType,
          boxSize,
          createdAt: now,
          ...(messagePayload.timestamps ? { timestamps: messagePayload.timestamps } : {}),
        },
        updatedAt: now,
      },
      $max: { 'members.$[sender].lastReadSeq': seq, 'members.$[sender].lastReadAt': now },
    },
    {
      arrayFilters: [{ 'sender.wallet': sender }],
    }
  ).catch(err => {
    log.warn('history_last_message_update_failed', {
      convId: conversationId,
      relayMessageId,
      error: err?.message || err,
    });
  });

  return { convId: conversationId, seq, existing: false };
}

export async function listConversationsForUser({ wallet, limit = 20, cursor }) {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const decodedCursor = decodeCursor(cursor);
  const filters = { 'members.wallet': wallet };

  const query = Conversation.find(filters)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .lean();

  if (decodedCursor?.ts) {
    const ts = new Date(decodedCursor.ts);
    const id = decodedCursor.id;
    query.where({
      $or: [
        { updatedAt: { $lt: ts } },
        { updatedAt: ts, _id: { $lt: id } },
      ],
    });
  }

  const conversations = await query.exec();
  const hasMore = conversations.length > safeLimit;
  const items = hasMore ? conversations.slice(0, safeLimit) : conversations;
  const nextCursor = hasMore
    ? encodeCursor({ ts: items[items.length - 1].updatedAt, id: items[items.length - 1]._id })
    : null;

  const normalized = items.map(conv => {
    const member = conv.members?.find(m => m.wallet === wallet) || {};
    const lastMessage = conv.lastMessage || null;
    if (lastMessage && !lastMessage.relayMessageId && lastMessage.messageId) {
      lastMessage.relayMessageId = lastMessage.messageId;
    }
    const unread = Math.max(0, (conv.seqMax || 0) - (member.lastReadSeq || 0));
    return {
      convId: conv._id,
      participants: conv.participants,
      lastMessage,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt,
      unread,
      seqMax: conv.seqMax,
      messageCount: conv.messageCount,
      memberState: {
        lastReadSeq: member.lastReadSeq || 0,
        lastReadAt: member.lastReadAt || null,
        joinedAt: member.joinedAt || conv.createdAt,
        pinned: Boolean(member.pinned),
        mutedUntil: member.mutedUntil || null,
      },
    };
  });

  return { items: normalized, nextCursor, hasMore };
}

export async function listMessagesForConversation({ wallet, convId, limit = 50, beforeSeq }) {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const conversation = await Conversation.findOne({ _id: convId, 'members.wallet': wallet }).lean();
  if (!conversation) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const filters = { convId };
  if (beforeSeq) {
    filters.seq = { $lt: beforeSeq };
  }

  const query = ConversationMessage.find(filters)
    .sort({ seq: -1 })
    .limit(safeLimit + 1)
    .lean();

  const messages = await query.exec();
  const hasMore = messages.length > safeLimit;
  const items = hasMore ? messages.slice(0, safeLimit) : messages;
  const nextCursor = hasMore ? String(items[items.length - 1].seq) : null;

  const normalizedItems = items.map((msg) => {
    if (!msg.relayMessageId && msg.messageId) {
      msg.relayMessageId = msg.messageId;
    }
    return msg;
  });

  return {
    items: normalizedItems,
    nextCursor,
    hasMore,
  };
}

export async function markConversationRead({ wallet, convId, seq, readAt = new Date() }) {
  const result = await Conversation.updateOne(
    { _id: convId, 'members.wallet': wallet },
    {
      $max: {
        'members.$.lastReadSeq': seq,
        'members.$.lastReadAt': readAt,
      },
    }
  );
  const matched = result.matchedCount ?? result.n ?? 0;
  return matched > 0;
}
