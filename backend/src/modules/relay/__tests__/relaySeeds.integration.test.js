import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import url from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import User from '#modules/users/models/user.model.js';
import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import Conversation from '#modules/history/models/conversation.model.js';
import ConversationMessage from '#modules/history/models/message.model.js';
import {
  PLAN_FREE,
  PLAN_PLUS,
  chooseWallets,
} from '../../../../scripts/seeds/seedWallets.js';
import { runSeed, cleanupPlan, createConversationId } from '../../../../scripts/seeds/relay.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME;

if (!mongoUri) {
  throw new Error('MONGO_URI requerido para ejecutar las pruebas de seeds');
}

test('seed Free/Plus produce cuotas esperadas', async (t) => {
  await runSeed({ plan: PLAN_FREE, drop: true, mongoUri });
  await runSeed({ plan: PLAN_PLUS, drop: true, mongoUri });

  await mongoose.connect(mongoUri, dbName ? { dbName } : undefined);

  t.after(async () => {
    await cleanupPlan(PLAN_FREE);
    await cleanupPlan(PLAN_PLUS);
    await mongoose.disconnect();
  });

  const plans = [
    {
      plan: PLAN_FREE,
      ratios: {
        warning: { relay: [0.65, 0.75], vault: [0.35, 0.5] },
        critical: { relay: [0.9, 0.99], vault: [0.85, 0.98] },
        fresh: { relay: [0, 0.1], vault: [0, 0.15] },
      },
    },
    {
      plan: PLAN_PLUS,
      ratios: {
        warning: { relay: [0.65, 0.75], vault: [0.6, 0.8] },
        critical: { relay: [0.9, 0.99], vault: [0.9, 0.98] },
        fresh: { relay: [0, 0.1], vault: [0, 0.15] },
      },
    },
  ];

  for (const { plan, ratios } of plans) {
    const wallets = chooseWallets(plan);
    const tier = plan;

    for (const { wallet, label } of wallets.recipients) {
      const user = await User.findOne({ wallet }).lean();
      assert.ok(user, `${plan}:${label} user missing`);
      assert.equal(user.relayTier, tier, `${plan}:${label} tier mismatch`);

      const relayQuota = user.relayQuotaBytes;
      const vaultQuota = user.vaultQuotaBytes;
      const relayRatio = relayQuota > 0 ? user.relayUsedBytes / relayQuota : 0;
      const vaultRatio = vaultQuota > 0 ? user.vaultUsedBytes / vaultQuota : 0;

      const expected = ratios[label];
      assert.ok(expected, `No ratios defined for ${plan}:${label}`);
      const [relayMin, relayMax] = expected.relay;
      const [vaultMin, vaultMax] = expected.vault;
      assert.ok(relayRatio >= relayMin && relayRatio <= relayMax, `${plan}:${label} relay ratio ${relayRatio.toFixed(3)} fuera de rango [${relayMin}, ${relayMax}]`);
      assert.ok(vaultRatio >= vaultMin && vaultRatio <= vaultMax, `${plan}:${label} vault ratio ${vaultRatio.toFixed(3)} fuera de rango [${vaultMin}, ${vaultMax}]`);

      const relayStats = await RelayMessage.aggregate([
        { $match: { to: wallet } },
        { $group: { _id: null, bytes: { $sum: '$boxSize' }, count: { $sum: 1 } } },
      ]);
      const relayBytes = relayStats?.[0]?.bytes || 0;
      assert.equal(relayBytes, user.relayUsedBytes, `${plan}:${label} relay bytes no alinean con relayUsedBytes`);

      const convId = createConversationId(wallet, wallets.sender);
      const msgStats = await ConversationMessage.aggregate([
        { $match: { convId } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAttachments: { $sum: { $size: { $ifNull: ['$attachments', []] } } },
            maxAttachmentSize: { $max: { $max: '$attachments.sizeBytes' } },
          },
        },
      ]);
      const msgCount = msgStats?.[0]?.count || 0;
      assert.ok(msgCount > 0, `${plan}:${label} sin mensajes en history`);

      if (label !== 'fresh') {
        const convo = await Conversation.findById(convId).lean();
        assert.ok(convo, `${plan}:${label} conversación no creada`);
        assert.equal(convo.lastMessage?.seq, msgCount, `${plan}:${label} seq mismatch`);
      }

      if (plan === PLAN_PLUS && label === 'critical') {
        const maxAttachmentSize = msgStats?.[0]?.maxAttachmentSize || 0;
        assert.ok(maxAttachmentSize >= 34 * 1024 * 1024, 'Plus critical debería tener adjunto ≥34MB');
      }
    }
  }
});
