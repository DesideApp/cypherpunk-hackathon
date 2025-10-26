// src/modules/stats/controllers/adminRelay.controller.js
import User from '#modules/users/models/user.model.js';
import logger from '#config/logger.js';

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

export default { listRelayUsage };

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
    const rows = await RelayMessage.aggregate(pipeline).allowDiskUse(true).catch(() => []);
    const totalsAgg = await RelayMessage.aggregate([
      { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$boxSize' } } }
    ]).catch(() => []);
    const totals = totalsAgg[0] || { count: 0, bytes: 0 };
    try { const DBG = String(process.env.STATS_DEBUG || 'false').toLowerCase() === 'true'; if (DBG) logger.info(`[relay] pending totals count=${totals.count} bytes=${totals.bytes} rows=${rows.length}`); } catch{}
    return res.status(200).json({ data: rows, totals });
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

    // Offline vs online (relay_message events)
    const msgAgg = await stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'relay_message', 'events.timestamp': { $gte: from, $lte: now } } },
      { $group: { _id: { online: '$events.data.recipientOnline', forced: '$events.data.forced' }, count: { $sum: 1 } } }
    ]).toArray().catch(() => []);

    // Errors (relay_error by code)
    const errAgg = await stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'relay_error', 'events.timestamp': { $gte: from, $lte: now } } },
      { $group: { _id: '$events.data.code', count: { $sum: 1 } } }
    ]).toArray().catch(() => []);

    // Purges (ttl + manual)
    const purgeAgg = await stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': { $in: ['relay_purged_ttl', 'relay_purged_manual'] }, 'events.timestamp': { $gte: from, $lte: now } } },
      { $group: { _id: '$events.type', count: { $sum: '$events.data.count' }, bytes: { $sum: '$events.data.freedBytes' } } }
    ]).toArray().catch(() => []);

    const out = {
      range: { from: from.toISOString(), to: now.toISOString() },
      messages: msgAgg.map((d) => ({ online: !!d._id?.online, forced: !!d._id?.forced, count: d.count })),
      errors: errAgg.map((e) => ({ code: e._id || 'unknown', count: e.count })),
      purges: purgeAgg.map((p) => ({ kind: p._id, count: p.count || 0, bytes: p.bytes || 0 }))
    };
    try { const DBG = String(process.env.STATS_DEBUG || 'false').toLowerCase() === 'true'; if (DBG) logger.info(`[relay] overview messages=${out.messages.length} errors=${out.errors.length} purges=${out.purges.length}`); } catch{}
    return res.status(200).json(out);
  } catch (error) {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return res.status(200).json({ range: { from: from.toISOString(), to: now.toISOString() }, messages: [], errors: [], purges: [] });
  }
}
