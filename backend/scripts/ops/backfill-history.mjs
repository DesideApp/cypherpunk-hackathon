#!/usr/bin/env node

import mongoose from 'mongoose';
import ConversationMessage from '../../src/modules/history/models/message.model.js';
import Conversation from '../../src/modules/history/models/conversation.model.js';
import { createModuleLogger } from '../../src/config/logger.js';

const log = createModuleLogger({ module: 'ops.backfillHistory' });

const BATCH_SIZE = Number.parseInt(process.env.HISTORY_BACKFILL_BATCH ?? '1000', 10);

async function connect() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME;
  if (!uri) {
    log.error('No MONGO_URI provided');
    process.exit(1);
  }
  await mongoose.connect(uri, dbName ? { dbName } : {});
  log.info('Connected to MongoDB', { dbName });
}

function normalizeSource(source) {
  if (typeof source === 'string' && source.trim()) {
    return source.trim().toLowerCase();
  }
  return 'relay';
}

async function backfillMessages() {
  const cursor = ConversationMessage.find(
    {
      $or: [
        { source: { $exists: false } },
        { source: null },
        { messageId: { $exists: false } },
        { messageId: null },
      ],
    },
    null,
    { lean: true }
  ).cursor();

  let processed = 0;
  let updated = 0;

  for await (const doc of cursor) {
    processed += 1;
    const patch = {};
    const src = normalizeSource(doc.source);
    if (!doc.source) patch.source = src;
    if (!doc.messageId && doc.relayMessageId) patch.messageId = doc.relayMessageId;

    if (Object.keys(patch).length) {
      await ConversationMessage.updateOne({ _id: doc._id }, { $set: patch });
      updated += 1;
    }

    if (BATCH_SIZE > 0 && processed >= BATCH_SIZE) break;
  }

  log.info('Backfill messages completed', { processed, updated });
}

async function backfillLastMessage() {
  const cursor = Conversation.find(
    {
      'lastMessage.relayMessageId': { $exists: true },
    },
    { lastMessage: 1 },
    { lean: true }
  ).cursor();

  let processed = 0;
  let updated = 0;

  for await (const conv of cursor) {
    processed += 1;
    const last = conv.lastMessage;
    if (!last) continue;

    const patch = {};
    if (!last.source) patch['lastMessage.source'] = 'relay';
    if (!last.messageId && last.relayMessageId) patch['lastMessage.messageId'] = last.relayMessageId;

    if (Object.keys(patch).length) {
      await Conversation.updateOne({ _id: conv._id }, { $set: patch });
      updated += 1;
    }

    if (BATCH_SIZE > 0 && processed >= BATCH_SIZE) break;
  }

  log.info('Backfill lastMessage completed', { processed, updated });
}

async function main() {
  await connect();
  try {
    await backfillMessages();
    await backfillLastMessage();
    log.info('History backfill finished');
    process.exit(0);
  } catch (err) {
    log.error('History backfill failed', { error: err?.message || err });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();

