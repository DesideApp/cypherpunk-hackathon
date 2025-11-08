// src/modules/stats/controllers/adminRelay.controller.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced MongoDB aggregations
// and tier-based quota calculations. Full implementation available
// in private repository.

import mongoose from 'mongoose';
import User from '#modules/users/models/user.model.js';
import logger from '#config/logger.js';
import config from '#config/appConfig.js';
import { getRelayStore } from '#modules/relay/services/relayStoreProvider.js';

/**
 * GET /api/v1/stats/admin/relay/usage
 * Query:
 *  - sortBy: 'usedBytes' | 'freeBytes' | 'quotaBytes' | 'ratio' (default 'usedBytes')
 *  - sortOrder: asc|desc (default desc)
 *  - limit: default 50 (max 200)
 */
export async function listRelayUsage(req, res) {
  try {
    const sortBy = (req.query.sortBy || 'usedBytes').toString();
    const sortOrder = ((req.query.sortOrder || 'desc').toString().toLowerCase() === 'asc') ? 1 : -1;
    const limitRaw = parseInt(req.query.limit || '50', 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));

    const pipeline = [
      { $project: {
          _id: 0,
          wallet: 1,
          nickname: 1,
          relayUsedBytes: { $ifNull: ['$relayUsedBytes', 0] },
          relayQuotaBytes: { $ifNull: ['$relayQuotaBytes', 0] },
          role: 1,
          banned: 1,
        }
      },
      { $addFields: {
          freeBytes: { $max: [{ $subtract: ['$relayQuotaBytes', '$relayUsedBytes'] }, 0] },
          ratio: {
            $cond: [
              { $gt: ['$relayQuotaBytes', 0] },
              { $divide: ['$relayUsedBytes', '$relayQuotaBytes'] },
              0
            ]
          }
        }
      },
    ];

    const sortMap = {
      usedBytes: { relayUsedBytes: sortOrder },
      quotaBytes: { relayQuotaBytes: sortOrder },
      freeBytes: { freeBytes: sortOrder },
      ratio: { ratio: sortOrder },
    };
    const sortStage = sortMap[sortBy] || sortMap.usedBytes;
    pipeline.push({ $sort: Object.assign({}, sortStage, { wallet: 1 }) });
    pipeline.push({ $limit: limit });

    const data = await User.aggregate(pipeline).allowDiskUse(true);
    return res.status(200).json({ data });
  } catch (error) {
    console.error('❌ [stats:admin] listRelayUsage failed:', error?.message || error);
    return res.status(500).json({ error: 'FAILED_TO_LIST_RELAY_USAGE', message: error?.message || 'Internal error' });
  }
}

const NUMERIC_TYPES = ['int', 'long', 'double', 'decimal'];
const TIER_ENTRIES = Object.entries(config.tiers || {});
const DEFAULT_WARNING_RATIO = Number.isFinite(config.relayWarningRatio) ? config.relayWarningRatio : 0.8;
const DEFAULT_CRITICAL_RATIO = Number.isFinite(config.relayCriticalRatio) ? config.relayCriticalRatio : 0.95;
const DEFAULT_RELAY_QUOTA = config.tiers?.free?.quotaBytes ?? 0;
const DEFAULT_VAULT_QUOTA = config.tiers?.free?.vaultQuotaBytes ?? 0;
const DEFAULT_GRACE_PCT = config.tiers?.free?.overflowGracePct ?? 0;

function tierValueExpr(field, fallback) {
  const branches = TIER_ENTRIES.map(([tier, def]) => ({
    case: { $eq: ['$relayTier', tier] },
    then: Number.isFinite(def?.[field]) ? def[field] : fallback,
  }));
  if (!TIER_ENTRIES.some(([tier]) => tier === 'basic') && config.tiers?.free) {
    branches.push({
      case: { $eq: ['$relayTier', 'basic'] },
      then: Number.isFinite(config.tiers.free[field]) ? config.tiers.free[field] : fallback,
    });
  }
  return {
    $switch: {
      branches,
      default: fallback,
    },
  };
}

// Simplified snapshot builder - production version has advanced tier-based aggregations
async function buildRelayUsageSnapshot() {
  try {
    // Simplified pipeline - production version has complex $facet aggregations
    const pipeline = [
      {
        $addFields: {
          relayUsed: { $ifNull: ['$relayUsedBytes', 0] },
          relayQuota: {
            $cond: [
              { $gt: ['$relayQuotaBytes', 0] },
              '$relayQuotaBytes',
              tierValueExpr('quotaBytes', DEFAULT_RELAY_QUOTA),
            ],
          },
          tierWarningRatio: tierValueExpr('warningRatio', DEFAULT_WARNING_RATIO),
          tierCriticalRatio: tierValueExpr('criticalRatio', DEFAULT_CRITICAL_RATIO),
          relayGracePct: {
            $cond: [
              { $in: [{ $type: '$relayOverflowGracePct' }, NUMERIC_TYPES] },
              '$relayOverflowGracePct',
              tierValueExpr('overflowGracePct', DEFAULT_GRACE_PCT),
            ],
          },
          vaultUsed: { $ifNull: ['$vaultUsedBytes', 0] },
          vaultQuota: {
            $cond: [
              { $gt: ['$vaultQuotaBytes', 0] },
              '$vaultQuotaBytes',
              tierValueExpr('vaultQuotaBytes', DEFAULT_VAULT_QUOTA),
            ],
          },
        },
      },
      {
        $addFields: {
          relayUsageRatio: {
            $cond: [
              { $gt: ['$relayQuota', 0] },
              { $divide: ['$relayUsed', '$relayQuota'] },
              0,
            ],
          },
          vaultUsageRatio: {
            $cond: [
              { $gt: ['$vaultQuota', 0] },
              { $divide: ['$vaultUsed', '$vaultQuota'] },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          relayUsageStatus: {
            $switch: {
              branches: [
                { case: { $gte: ['$relayUsageRatio', '$tierCriticalRatio'] }, then: 'critical' },
                { case: { $gte: ['$relayUsageRatio', '$tierWarningRatio'] }, then: 'warning' },
              ],
              default: 'ok',
            },
          },
          vaultUsageStatus: {
            $switch: {
              branches: [
                { case: { $gte: ['$vaultUsageRatio', '$tierCriticalRatio'] }, then: 'critical' },
                { case: { $gte: ['$vaultUsageRatio', '$tierWarningRatio'] }, then: 'warning' },
              ],
              default: 'ok',
            },
          },
        },
      },
      {
        $project: {
          wallet: 1,
          nickname: 1,
          relayUsed: 1,
          relayQuota: 1,
          relayUsageRatio: 1,
          relayUsageStatus: 1,
          relayGracePct: 1,
          vaultUsed: 1,
          vaultQuota: 1,
          vaultUsageRatio: 1,
          vaultUsageStatus: 1,
        },
      },
      {
        $facet: {
          relayTotals: [
            {
              $group: {
                _id: null,
                wallets: { $sum: 1 },
                usedBytes: { $sum: '$relayUsed' },
                quotaBytes: { $sum: '$relayQuota' },
                avgUsageRatio: { $avg: '$relayUsageRatio' },
              },
            },
          ],
          relayStatusCounts: [
            { $group: { _id: '$relayUsageStatus', count: { $sum: 1 } } },
          ],
          relayTop: [
            { $match: { relayQuota: { $gt: 0 } } },
            { $sort: { relayUsageRatio: -1, wallet: 1 } },
            { $limit: 8 },
            {
              $project: {
                _id: 0,
                wallet: 1,
                nickname: 1,
                usedBytes: '$relayUsed',
                quotaBytes: '$relayQuota',
                usageRatio: '$relayUsageRatio',
                status: '$relayUsageStatus',
              },
            },
          ],
          relayGrace: [
            { $match: { $expr: { $gt: ['$relayUsed', '$relayQuota'] } } },
            {
              $group: {
                _id: null,
                wallets: { $sum: 1 },
                excessBytes: { $sum: { $subtract: ['$relayUsed', '$relayQuota'] } },
                avgGracePct: { $avg: '$relayGracePct' },
              },
            },
          ],
          vaultTotals: [
            {
              $group: {
                _id: null,
                wallets: { $sum: 1 },
                usedBytes: { $sum: '$vaultUsed' },
                quotaBytes: { $sum: '$vaultQuota' },
                avgUsageRatio: { $avg: '$vaultUsageRatio' },
              },
            },
          ],
          vaultStatusCounts: [
            { $group: { _id: '$vaultUsageStatus', count: { $sum: 1 } } },
          ],
          vaultTop: [
            { $match: { vaultQuota: { $gt: 0 } } },
            { $sort: { vaultUsageRatio: -1, wallet: 1 } },
            { $limit: 8 },
            {
              $project: {
                _id: 0,
                wallet: 1,
                nickname: 1,
                usedBytes: '$vaultUsed',
                quotaBytes: '$vaultQuota',
                usageRatio: '$vaultUsageRatio',
                status: '$vaultUsageStatus',
              },
            },
          ],
        },
      },
    ];

    const [snapshot] = await User.aggregate(pipeline).allowDiskUse(true);
    const relayTotals = snapshot?.relayTotals?.[0] || null;
    const vaultTotals = snapshot?.vaultTotals?.[0] || null;
    const relayGrace = snapshot?.relayGrace?.[0] || null;

    const formatStatusCounts = (rows = []) => {
      const base = { ok: 0, warning: 0, critical: 0 };
      rows.forEach((row) => {
        if (!row?._id) return;
        base[row._id] = row.count || 0;
      });
      return base;
    };

    const toTotals = (entry) => ({
      wallets: entry?.wallets ?? 0,
      usedBytes: entry?.usedBytes ?? 0,
      quotaBytes: entry?.quotaBytes ?? 0,
      freeBytes: Math.max(0, (entry?.quotaBytes ?? 0) - (entry?.usedBytes ?? 0)),
      avgUsageRatio: entry?.avgUsageRatio ?? 0,
    });

    return {
      updatedAt: new Date().toISOString(),
      relay: {
        totals: toTotals(relayTotals),
        statusCounts: formatStatusCounts(snapshot?.relayStatusCounts),
        grace: {
          wallets: relayGrace?.wallets ?? 0,
          excessBytes: relayGrace?.excessBytes ?? 0,
          avgGracePct: relayGrace?.avgGracePct ?? 0,
        },
        topWallets: snapshot?.relayTop ?? [],
      },
      vault: {
        totals: toTotals(vaultTotals),
        statusCounts: formatStatusCounts(snapshot?.vaultStatusCounts),
        topWallets: snapshot?.vaultTop ?? [],
      },
    };
  } catch (error) {
    logger.warn('[relay:stats] Failed to build usage snapshot', { error: error?.message || error });
    return {
      updatedAt: new Date().toISOString(),
      relay: {
        totals: { wallets: 0, usedBytes: 0, quotaBytes: 0, freeBytes: 0, avgUsageRatio: 0 },
        statusCounts: { ok: 0, warning: 0, critical: 0 },
        grace: { wallets: 0, excessBytes: 0, avgGracePct: 0 },
        topWallets: [],
      },
      vault: {
        totals: { wallets: 0, usedBytes: 0, quotaBytes: 0, freeBytes: 0, avgUsageRatio: 0 },
        statusCounts: { ok: 0, warning: 0, critical: 0 },
        topWallets: [],
      },
      error: 'FAILED_TO_BUILD_USAGE_SNAPSHOT',
    };
  }
}

export default { listRelayUsage, getRelayCapacity, getRelayErrors };

/**
 * GET /api/v1/stats/admin/relay/capacity
 * Totales globales y usuarios más cercanos a la cuota.
 */
export async function getRelayCapacity(req, res) {
  try {
    const warningThreshold = Number.parseFloat(req.query.warning ?? '0.8');
    const criticalThreshold = Number.parseFloat(req.query.critical ?? '0.95');
    const limitRaw = Number.parseInt(req.query.limit ?? '5', 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 5));

    const [totalsAgg] = await User.aggregate([
      {
        $group: {
          _id: null,
          usedBytes: { $sum: { $ifNull: ['$relayUsedBytes', 0] } },
          quotaBytes: { $sum: { $ifNull: ['$relayQuotaBytes', 0] } },
          users: { $sum: 1 },
        },
      },
    ]);

    const usedBytes = totalsAgg?.usedBytes ?? 0;
    const quotaBytes = totalsAgg?.quotaBytes ?? 0;
    const usersCount = totalsAgg?.users ?? 0;
    const globalRatio = quotaBytes > 0 ? usedBytes / quotaBytes : 0;
    const freeBytes = Math.max(0, quotaBytes - usedBytes);

    const hotspotsRaw = await User.aggregate([
      {
        $project: {
          wallet: 1,
          nickname: 1,
          relayUsedBytes: { $ifNull: ['$relayUsedBytes', 0] },
          relayQuotaBytes: { $ifNull: ['$relayQuotaBytes', 0] },
          ratio: {
            $cond: [
              { $gt: ['$relayQuotaBytes', 0] },
              { $divide: ['$relayUsedBytes', '$relayQuotaBytes'] },
              0,
            ],
          },
        },
      },
      { $match: { ratio: { $gte: warningThreshold } } },
      { $sort: { ratio: -1, wallet: 1 } },
      { $limit: limit },
    ]).allowDiskUse(true);

    const hotspots = hotspotsRaw.map((item) => ({
      wallet: item.wallet,
      nickname: item.nickname || null,
      usedBytes: item.relayUsedBytes,
      quotaBytes: item.relayQuotaBytes,
      ratio: item.ratio,
      level: item.ratio >= criticalThreshold ? 'critical' : 'warning',
    }));

    const relayStore = getRelayStore();
    const { totals } = await relayStore.aggregatePending(1);

    return res.status(200).json({
      totals: {
        usedBytes,
        quotaBytes,
        freeBytes,
        users: usersCount,
        globalRatio,
        warningThreshold,
        criticalThreshold,
        pendingMessages: totals?.count ?? 0,
        pendingBytes: totals?.bytes ?? 0,
      },
      hotspots,
    });
  } catch (error) {
    console.error('❌ [stats:admin] getRelayCapacity failed:', error?.message || error);
    return res.status(500).json({ error: 'FAILED_TO_GET_RELAY_CAPACITY', message: error?.message || 'Internal error' });
  }
}

/**
 * GET /api/v1/stats/admin/relay/pending
 * Top mailboxes by pending messages/bytes.
 * Query: limit (default 20)
 */
export async function listRelayPending(req, res) {
  try {
    const limitRaw = parseInt(req.query.limit || '20', 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));
    const pipeline = [
      { $group: { _id: '$to', count: { $sum: 1 }, bytes: { $sum: '$boxSize' }, oldest: { $min: '$createdAt' } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { bytes: -1, count: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: '_id', foreignField: 'wallet', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { wallet: '$_id', count: 1, bytes: 1, oldest: 1, nickname: '$user.nickname', role: '$user.role' } }
    ];
    const relayStore = getRelayStore();
    const { rows, totals } = await relayStore.aggregatePending(limit);

    const wallets = rows.map((row) => row._id);
    const users = await User.find({ wallet: { $in: wallets } }, { wallet: 1, nickname: 1, role: 1 }).lean();
    const userMap = new Map(users.map((u) => [u.wallet, u]));

    const data = rows.map((row) => {
      const user = userMap.get(row._id) || {};
      return {
        wallet: row._id,
        count: row.count,
        bytes: row.bytes,
        oldest: row.oldest,
        nickname: user.nickname || null,
        role: user.role || null,
      };
    });

    try {
      const DBG = String(process.env.STATS_DEBUG || 'false').toLowerCase() === 'true';
      if (DBG) logger.info(`[relay] pending totals count=${totals.count} bytes=${totals.bytes} rows=${data.length}`);
    } catch {}

    return res.status(200).json({ data, totals });
  } catch (error) {
    return res.status(200).json({ data: [], totals: { count: 0, bytes: 0 } });
  }
}

/**
 * GET /api/v1/stats/admin/relay/overview
 * Overall relay metrics: offline/online ratio (last24h), forced, errors, purges.
 */
export async function getRelayOverview(req, res) {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const db = mongoose.connection?.db;
    if (!db) {
      return res.status(200).json({ range: { from: from.toISOString(), to: now.toISOString() }, messages: [], errors: [], purges: [] });
    }
    const stats = db.collection('stats');

    const usagePromise = buildRelayUsageSnapshot();

    const msgAggPromise = stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'relay_message', 'events.timestamp': { $gte: from, $lte: now } } },
      { $group: { _id: { online: '$events.data.recipientOnline', forced: '$events.data.forced' }, count: { $sum: 1 } } }
    ]).toArray().catch(() => []);

    const errAggPromise = stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'relay_error', 'events.timestamp': { $gte: from, $lte: now } } },
      { $group: { _id: '$events.data.code', count: { $sum: 1 } } }
    ]).toArray().catch(() => []);

    const purgeAggPromise = stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': { $in: ['relay_purged_ttl', 'relay_purged_manual'] }, 'events.timestamp': { $gte: from, $lte: now } } },
      { $group: { _id: '$events.type', count: { $sum: '$events.data.count' }, bytes: { $sum: '$events.data.freedBytes' } } }
    ]).toArray().catch(() => []);

    const [msgAgg, errAgg, purgeAgg, usage] = await Promise.all([
      msgAggPromise,
      errAggPromise,
      purgeAggPromise,
      usagePromise,
    ]);

    const out = {
      range: { from: from.toISOString(), to: now.toISOString() },
      messages: msgAgg.map((d) => ({ online: !!d._id?.online, forced: !!d._id?.forced, count: d.count })),
      errors: errAgg.map((e) => ({ code: e._id || 'unknown', count: e.count })),
      purges: purgeAgg.map((p) => ({ kind: p._id, count: p.count || 0, bytes: p.bytes || 0 })),
      usage: usage || null,
    };
    try { const DBG = String(process.env.STATS_DEBUG || 'false').toLowerCase() === 'true'; if (DBG) logger.info(`[relay] overview messages=${out.messages.length} errors=${out.errors.length} purges=${out.purges.length}`); } catch{}
    return res.status(200).json(out);
  } catch (error) {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return res.status(200).json({ range: { from: from.toISOString(), to: now.toISOString() }, messages: [], errors: [], purges: [] });
  }
}

/**
 * GET /api/v1/stats/admin/relay/errors
 * Distribución de errores relay_error por código en las últimas 24h.
 */
export async function getRelayErrors(req, res) {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const db = mongoose.connection?.db;
    if (!db) {
      return res.status(200).json({ range: { from: from.toISOString(), to: now.toISOString() }, errors: [] });
    }
    const stats = db.collection('stats');
    const errAgg = await stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'relay_error', 'events.timestamp': { $gte: from, $lte: now } } },
      {
        $group: {
          _id: '$events.data.code',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]).toArray().catch(() => []);

    const out = errAgg.map((item) => ({
      code: item._id || 'unknown',
      count: item.count || 0,
    }));

    return res.status(200).json({
      range: { from: from.toISOString(), to: now.toISOString() },
      errors: out,
    });
  } catch (error) {
    return res.status(500).json({ error: 'FAILED_TO_GET_RELAY_ERRORS', message: error?.message || 'Internal error' });
  }
}
