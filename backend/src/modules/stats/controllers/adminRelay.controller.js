// src/modules/stats/controllers/adminRelay.controller.js
import User from '#modules/users/models/user.model.js';

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

