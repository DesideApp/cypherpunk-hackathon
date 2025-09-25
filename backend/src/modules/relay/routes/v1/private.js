import { Router } from 'express';
import {
  enqueueMessage,
  fetchMessages,
  ackMessages,
  getRelayPolicy,
  getRelayConfig,
} from '#modules/relay/controllers/relay.controller.js';
import User from '#modules/users/models/user.model.js';
import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import config from '#config/appConfig.js';

const router = Router();

/**
 * Todas privadas (JWT) — protectRoute se aplica en v1/index.js
 * Compat: /api/relay/*
 * v1:     /api/relay/v1/me/*
 */

router.post('/enqueue', enqueueMessage);
router.get('/fetch', fetchMessages);
router.post('/ack', ackMessages);
router.get('/policy', getRelayPolicy);
router.get('/config', getRelayConfig);

/**
 * GET /usage — incluye campos legacy para UIs antiguas.
 */
router.get('/usage', async (req, res) => {
  try {
    const wallet = req?.user?.wallet;
    if (!wallet) return res.status(401).json({ error: 'unauthorized' });

    const user = await User.findOne(
      { wallet },
      { relayTier: 1, relayQuotaBytes: 1, relayUsedBytes: 1, relayTTLSeconds: 1 }
    ).lean();

    const currentTier = user?.relayTier || 'basic';
    const tierDef     = config.tiers[currentTier] || config.tiers.basic;

    const quota = Number.isFinite(user?.relayQuotaBytes) ? user.relayQuotaBytes : tierDef.quotaBytes;
    const used  = Number.isFinite(user?.relayUsedBytes)  ? user.relayUsedBytes  : 0;
    const ttl   = Number.isFinite(user?.relayTTLSeconds) ? user.relayTTLSeconds : tierDef.ttlSeconds;
    const free  = Math.max(0, quota - used);

    const basicDef = config.tiers.basic;
    const globalCap = config.relayMaxBoxBytes;

    res.status(200).json({
      tier: currentTier,
      quotaBytes: quota,
      usedBytes: used,
      freeBytes: free,
      ttlSeconds: ttl,
      perMessageMaxBytes: tierDef.perMessageMaxBytes ?? globalCap,
      tiers: {
        basic: {
          quotaBytes: basicDef.quotaBytes,
          ttlSeconds: basicDef.ttlSeconds,
          perMessageMaxBytes: basicDef.perMessageMaxBytes ?? globalCap,
        },
      },
      basicQuotaBytes: basicDef.quotaBytes,
      basicTtlSeconds: basicDef.ttlSeconds,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get usage stats', details: error.message });
  }
});

/**
 * POST /purge — borra todo el buzón Relay del usuario y recalcula usedBytes.
 */
router.post('/purge', async (req, res) => {
  try {
    const wallet = req?.user?.wallet;
    if (!wallet) return res.status(401).json({ error: 'unauthorized' });

    const docs = await RelayMessage.find({ to: wallet }, { boxSize: 1 }).lean();
    const bytesFreed = docs.reduce((sum, d) => sum + (d.boxSize || 0), 0);

    await RelayMessage.deleteMany({ to: wallet });

    // Recalcula el usedBytes restante tras la purga (a prueba de carreras).
    const [remain] = await RelayMessage.aggregate([
      { $match: { to: wallet } },
      { $group: { _id: null, bytes: { $sum: '$boxSize' } } },
    ]);
    const remainBytes = remain?.bytes || 0;

    await User.updateOne({ wallet }, { $set: { relayUsedBytes: remainBytes } });

    res.status(200).json({
      ok: true,
      messagesDeleted: docs.length,
      bytesFreed,
      usedBytesNow: remainBytes,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to purge messages', details: error.message });
  }
});

export default router;
