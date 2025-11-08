// src/modules/history/services/history.service.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced deduplication logic,
// attachment handling, vault usage tracking, and rollback mechanisms.
// Full implementation available in private repository.

import Conversation from '../models/conversation.model.js';
import ConversationMessage from '../models/message.model.js';
import User from '#modules/users/models/user.model.js';
import config from '#config/appConfig.js';
import logger, { createModuleLogger } from '#config/logger.js';
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
    return parsed || null;
  } catch (err) {
    log.warn('history_cursor_decode_failed', { error: err?.message || err });
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

  // Simplified deduplication - production version has advanced logic
  let existing = null;
  if (normalizedSource && normalizedMessageId) {
    existing = await ConversationMessage.findOne({ source: normalizedSource, messageId: normalizedMessageId }).lean();
  }
  if (!existing && relayMessageId) {
    existing = await ConversationMessage.findOne({ relayMessageId }).lean();
  }
  if (existing) {
    recordMessageDuplicate(existing.source || normalizedSource || 'relay');
    return { convId: existing.convId, seq: existing.seq, existing: true };
  }

  const now = createdAt instanceof Date ? createdAt : new Date(createdAt);

  // Simplified conversation creation - production version has advanced member management
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

  // Simplified attachment handling - production version has advanced normalization and vault tracking
  let normalizedAttachments = undefined;
  if (Array.isArray(attachments) && attachments.length) {
    normalizedAttachments = attachments
      .filter(att => att?.key && att?.bucket)
      .map(att => ({
        key: att.key.trim(),
        bucket: att.bucket.trim() || config.attachmentVault?.bucket,
        mimeType: att.mimeType || 'application/octet-stream',
        sizeBytes: Math.max(0, Number(att.sizeBytes) || 0),
        hash: att.hash || null,
        thumbnailKey: att.thumbnailKey || null,
        expiresAt: att.expiresAt ? new Date(att.expiresAt) : null,
        createdAt: att.createdAt ? new Date(att.createdAt) : now,
      }));
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
    recordMessageWritten(normalizedSource || 'relay');
    
    // Simplified vault tracking - production version has advanced metrics
    if (normalizedAttachments?.length) {
      const totalBytes = normalizedAttachments.reduce((sum, att) => sum + (att.sizeBytes || 0), 0);
      if (totalBytes > 0) {
        await User.findOneAndUpdate(
          { wallet: sender },
          { $inc: { vaultUsedBytes: totalBytes } }
        ).catch(() => {});
      }
    }
  } catch (err) {
    if (err?.code === 11000) {
      recordMessageDuplicate(normalizedSource || 'relay');
      return { convId: conversationId, seq, existing: true };
    }
    // Simplified rollback - production version has advanced error handling
    await Conversation.updateOne(
      { _id: conversationId },
      { $inc: { seqMax: -1, messageCount: -1 } }
    ).catch(() => {});
    log.error('history_message_insert_failed', {
      convId: conversationId,
      relayMessageId,
      error: err?.message || err,
    });
    recordMessageFailed(normalizedSource || 'relay', err?.code || err?.name || 'write_error');
    throw err;
  }

  // Simplified last message update - production version has advanced array filters
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
    }
  ).catch(() => {});

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
