import Conversation from '../models/conversation.model.js';
import ConversationMessage from '../models/message.model.js';
import logger from '#config/logger.js';

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
    logger.warn(`⚠️ history cursor decode failed: ${err?.message || err}`);
    return null;
  }
}

export async function appendMessageToHistory({
  convId,
  participants,
  sender,
  relayMessageId,
  clientMsgId,
  box,
  boxSize,
  iv,
  messageType = 'text',
  meta,
  createdAt = new Date(),
}) {
  if (!relayMessageId) {
    throw new Error('appendMessageToHistory requires relayMessageId');
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

  const existing = await ConversationMessage.findOne({ relayMessageId }).lean();
  if (existing) {
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
    ).catch(err => logger.warn(`⚠️ history add-member failed: ${err?.message || err}`));
  }

  const messagePayload = {
    convId: conversationId,
    seq,
    sender,
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

  try {
    await ConversationMessage.create(messagePayload);
  } catch (err) {
    if (err?.code === 11000) {
      return { convId: conversationId, seq, existing: true };
    }
    // revert counters if insert fails
    await Conversation.updateOne(
      { _id: conversationId },
      { $inc: { seqMax: -1, messageCount: -1 } }
    ).catch(e => logger.warn(`⚠️ history rollback failed: ${e?.message || e}`));
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
          messageType,
          boxSize,
          createdAt: now,
        },
        updatedAt: now,
      },
      $max: { 'members.$[sender].lastReadSeq': seq, 'members.$[sender].lastReadAt': now },
    },
    {
      arrayFilters: [{ 'sender.wallet': sender }],
    }
  ).catch(err => {
    logger.warn(`⚠️ history lastMessage update failed: ${err?.message || err}`);
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
    const unread = Math.max(0, (conv.seqMax || 0) - (member.lastReadSeq || 0));
    return {
      convId: conv._id,
      participants: conv.participants,
      lastMessage: conv.lastMessage,
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

  return {
    items,
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
