#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import config from '#config/appConfig.js';
import User from '#modules/users/models/user.model.js';
import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import Conversation from '#modules/history/models/conversation.model.js';
import ConversationMessage from '#modules/history/models/message.model.js';
import { PLAN_FREE, PLAN_PLUS, chooseWallets } from './seedWallets.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPPORTED_PLANS = new Set([PLAN_FREE, PLAN_PLUS]);

function parseArgs(argv) {
  const args = {};
  argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.replace(/^--/, '').split('=');
      if (value === undefined) {
        args[key] = true;
      } else {
        args[key] = value;
      }
    }
  });
  return args;
}

export function createConversationId(a, b) {
  return [a, b].sort().join('__');
}

function randomBase64(size) {
  return crypto.randomBytes(size).toString('base64');
}

function buildAttachment({ wallet, sizeBytes, ttlSeconds, index }) {
  const now = new Date();
  return {
    key: `${wallet}/seed-attachment-${index}-${crypto.randomUUID()}`,
    bucket: config.attachmentVault.bucket || 'relay-attachments',
    mimeType: sizeBytes > 20 * 1024 * 1024 ? 'video/mp4' : 'image/jpeg',
    sizeBytes,
    hash: crypto.createHash('sha256').update(`${wallet}-${index}-${sizeBytes}`).digest('hex'),
    thumbnailKey: null,
    expiresAt: ttlSeconds ? new Date(now.getTime() + ttlSeconds * 1000) : null,
    createdAt: now,
  };
}

export async function cleanupPlan(plan) {
  const wallets = chooseWallets(plan);
  const conversationIds = wallets.recipients.map((recipient) =>
    createConversationId(wallets.sender, recipient.wallet)
  );
  const walletSet = new Set([
    wallets.sender,
    ...wallets.recipients.map((r) => r.wallet),
  ]);

  console.log(`[seed:${plan}] Limpiando datos previos...`);
  await Promise.all([
    User.deleteMany({ wallet: { $in: Array.from(walletSet) } }),
    RelayMessage.deleteMany({ $or: [{ to: { $in: Array.from(walletSet) } }, { from: { $in: Array.from(walletSet) } }] }),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    ConversationMessage.deleteMany({ convId: { $in: conversationIds } }),
  ]);
}

export async function seedPlan(plan) {
  const tierDef = config.tiers[plan] || config.tiers.free;
  const wallets = chooseWallets(plan);
  const sender = wallets.sender;
  const now = new Date();

  const usageScenarios = plan === PLAN_FREE
    ? [
        { label: 'warning', relayRatio: 0.7, vaultRatio: 0.4 },
        { label: 'critical', relayRatio: 0.95, vaultRatio: 0.9 },
        { label: 'grace', relayRatio: 1.05, vaultRatio: 0.95 },
        { label: 'fresh', relayRatio: 0.05, vaultRatio: 0.05 },
      ]
    : [
        { label: 'warning', relayRatio: 0.7, vaultRatio: 0.65 },
        { label: 'critical', relayRatio: 0.95, vaultRatio: 0.92 },
        { label: 'grace', relayRatio: 1.08, vaultRatio: 0.97 },
        { label: 'fresh', relayRatio: 0.05, vaultRatio: 0.05 },
      ];

  for (const scenario of usageScenarios) {
    const recipient = wallets.recipients.find((r) => r.label === scenario.label);
    if (!recipient) continue;

    const wallet = recipient.wallet;
    const relayQuota = tierDef.quotaBytes;
    const vaultQuota = tierDef.vaultQuotaBytes;
    const relayTargetBytes = Math.floor(relayQuota * scenario.relayRatio);
    const vaultTargetBytes = Math.floor(vaultQuota * scenario.vaultRatio);

    const userPayload = {
      wallet,
      relayTier: plan,
      relayQuotaBytes: relayQuota,
      relayUsedBytes: relayTargetBytes,
      relayTTLSeconds: tierDef.ttlSeconds,
      relayOverflowGracePct: tierDef.overflowGracePct ?? 0,
      vaultQuotaBytes: vaultQuota,
      vaultUsedBytes: vaultTargetBytes,
      vaultTTLSeconds: tierDef.vaultTtlSeconds,
      registeredAt: now,
      lastLogin: now,
      loginCount: 1,
    };

    await User.findOneAndUpdate(
      { wallet },
      { $set: userPayload },
      { upsert: true, new: true },
    );

    const conversationId = createConversationId(wallet, sender);
    const participants = [wallet, sender];
    const relayMessages = [];
    const historyMessages = [];
    let accumulatedRelayBytes = 0;
    let accumulatedVaultBytes = 0;
    let seq = 1;

    const sizes = scenario.label === 'fresh'
      ? [Math.min(relayQuota * 0.02, 500_000)]
      : [
          Math.min(Math.floor(relayQuota * scenario.relayRatio * 0.4), 5 * 1024 * 1024),
          Math.min(Math.floor(relayQuota * scenario.relayRatio * 0.3), 4 * 1024 * 1024),
          Math.min(Math.floor(relayQuota * scenario.relayRatio * 0.3), 3 * 1024 * 1024),
        ];

    for (let i = 0; i < sizes.length; i += 1) {
      const boxSize = Math.max(1024, Math.floor(sizes[i]));
      accumulatedRelayBytes += boxSize;
      const messageId = crypto.randomUUID();
      const createdAt = new Date(now.getTime() - (sizes.length - i) * 60_000);
      const relayDoc = {
        _id: messageId,
        from: sender,
        to: wallet,
        box: randomBase64(Math.min(boxSize, 2 * 1024 * 1024)),
        boxSize,
        iv: null,
        messageType: 'text',
        meta: null,
        timestamps: {
          enqueuedAt: createdAt,
          deliveredAt: null,
          acknowledgedAt: null,
        },
        status: 'pending',
        createdAt,
      };

      relayMessages.push(relayDoc);

      const historyDoc = {
        convId: conversationId,
        seq,
        sender,
        source: 'relay',
        messageId,
        participants,
        relayMessageId: messageId,
        box: relayDoc.box,
        boxSize,
        iv: null,
        messageType: relayDoc.messageType,
        meta: relayDoc.meta || undefined,
        timestamps: undefined,
        createdAt,
        updatedAt: createdAt,
      };

      historyMessages.push(historyDoc);
      seq += 1;
    }

    const remainingRelay = relayTargetBytes - accumulatedRelayBytes;
    if (remainingRelay > 1024) {
      const boxSize = Math.floor(remainingRelay);
      const messageId = crypto.randomUUID();
      const createdAt = new Date(now.getTime() - 30_000);
      const relayDoc = {
        _id: messageId,
        from: sender,
        to: wallet,
        box: randomBase64(Math.min(boxSize, 2 * 1024 * 1024)),
        boxSize,
        iv: null,
        messageType: 'text',
        meta: null,
        timestamps: {
          enqueuedAt: createdAt,
          deliveredAt: null,
          acknowledgedAt: null,
        },
        status: 'pending',
        createdAt,
      };
      relayMessages.push(relayDoc);
      accumulatedRelayBytes += boxSize;

      historyMessages.push({
        convId: conversationId,
        seq,
        sender,
        source: 'relay',
        messageId,
        participants,
        relayMessageId: messageId,
        box: relayDoc.box,
        boxSize,
        iv: null,
        messageType: 'text',
        meta: undefined,
        attachments: undefined,
        timestamps: undefined,
        createdAt,
        updatedAt: createdAt,
      });
      seq += 1;
    }

    if (vaultTargetBytes > 0 && historyMessages.length) {
      let remainingVault = vaultTargetBytes;
      const chunkMax = plan === PLAN_FREE ? 12 * 1024 * 1024 : 40 * 1024 * 1024;
      const chunkMin = plan === PLAN_FREE ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
      let idx = 0;
      while (remainingVault > 0) {
        let chunk = Math.min(chunkMax, remainingVault);
        if (chunk < chunkMin && remainingVault > chunkMin) {
          chunk = chunkMin;
        }
        if (chunk > remainingVault) chunk = remainingVault;
        const message = historyMessages[idx % historyMessages.length];
        if (!message.attachments) message.attachments = [];
        const attachment = buildAttachment({
          wallet,
          sizeBytes: chunk,
          ttlSeconds: tierDef.vaultTtlSeconds,
          index: message.attachments.length + 1,
        });
        message.attachments.push(attachment);
        accumulatedVaultBytes += chunk;
        remainingVault -= chunk;
        idx += 1;
      }
    }

    await RelayMessage.insertMany(relayMessages, { ordered: true });
    await ConversationMessage.insertMany(historyMessages, { ordered: true });

    const lastMessage = historyMessages[historyMessages.length - 1];
    await Conversation.findOneAndUpdate(
      { _id: conversationId },
      {
        $set: {
          participants,
          members: participants.map((participant) => ({
            wallet: participant,
            lastReadSeq: participant === wallet ? lastMessage.seq - 1 : lastMessage.seq,
            lastReadAt: now,
            joinedAt: now,
            pinned: false,
            mutedUntil: null,
          })),
          seqMax: lastMessage.seq,
          messageCount: historyMessages.length,
          lastMessage: {
            seq: lastMessage.seq,
            sender: lastMessage.sender,
            source: lastMessage.source,
            relayMessageId: lastMessage.relayMessageId,
            messageId: lastMessage.messageId,
            messageType: lastMessage.messageType,
            boxSize: lastMessage.boxSize,
            createdAt: lastMessage.createdAt,
          },
        },
      },
      { upsert: true },
    );

    await User.updateOne(
      { wallet },
      {
        $set: {
          relayUsedBytes: accumulatedRelayBytes,
          vaultUsedBytes: accumulatedVaultBytes,
        },
      },
    );

    console.log(`[seed:${plan}] wallet=${wallet} relayUsed=${accumulatedRelayBytes} vaultUsed=${accumulatedVaultBytes}`);
  }
}

export async function runSeed(options = {}) {
  const { plan, drop = false, mongoUri: uriOverride } = options;
  if (!plan || !SUPPORTED_PLANS.has(plan)) {
    throw new Error(`Plan inválido. Usa uno de: ${Array.from(SUPPORTED_PLANS).join(', ')}`);
  }

  const mongoUri = uriOverride || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('Debes definir MONGO_URI o pasar mongoUri');
  }

  console.log(`[seed] Conectando a MongoDB (${plan})...`);
  await mongoose.connect(
    mongoUri,
    process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : undefined
  );

  try {
    if (drop) {
      await cleanupPlan(plan);
    }
    await seedPlan(plan);
    console.log(`[seed] Plan ${plan} completado`);
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const plan = args.plan;
  try {
    await runSeed({
      plan,
      drop: Boolean(args.drop),
      mongoUri: args.mongoUri,
    });
  } catch (error) {
    console.error('[seed] Error inesperado', error);
    process.exitCode = 1;
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1] || '').href) {
  try {
    await main();
  } catch (error) {
    console.error('[seed] Failed', error?.message || error);
    process.exit(1);
  }
}
