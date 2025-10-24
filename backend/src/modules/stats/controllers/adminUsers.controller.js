// src/modules/stats/controllers/adminUsers.controller.js
import User from '#modules/users/models/user.model.js';
import mongoose from 'mongoose';

/**
 * GET /api/v1/stats/admin/users
 * Query:
 *  - page: number (default 1)
 *  - limit: number (default 50, max 200)
 *  - search: string (wallet/nickname, case-insensitive)
 *  - sortBy: one of [lastLogin, registeredAt, loginCount, messagesSent, relayUsedBytes]
 *  - sortOrder: asc|desc (default desc)
 */
export async function listUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const limitRaw = parseInt(req.query.limit || '50', 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
    const search = (req.query.search || '').toString().trim();
    const sortBy = (req.query.sortBy || 'lastLogin').toString();
    const sortOrder = ((req.query.sortOrder || 'desc').toString().toLowerCase() === 'asc') ? 1 : -1;

    // Build filter over User fields
    const filter = {};
    if (search) {
      filter.$or = [
        { wallet:   { $regex: search, $options: 'i' } },
        { nickname: { $regex: search, $options: 'i' } },
      ];
    }

    // Count total matching users
    const total = await User.countDocuments(filter).lean();

    // Sorting map
    const SORT_FIELDS = new Set(['lastLogin', 'registeredAt', 'loginCount', 'messagesSent', 'relayUsedBytes']);
    const effectiveSort = SORT_FIELDS.has(sortBy) ? sortBy : 'lastLogin';

    // Aggregation to join Stats (for messagesSent) and project required fields
    const pipeline = [
      { $match: filter },
      { $lookup: {
          from: 'stats',
          localField: 'wallet',
          foreignField: 'user',
          as: 'statsDoc'
        }
      },
      { $unwind: { path: '$statsDoc', preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 0,
          wallet: 1,
          nickname: 1,
          role: 1,
          banned: 1,
          registeredAt: 1,
          lastLogin: 1,
          loginCount: 1,
          relayUsedBytes: 1,
          relayQuotaBytes: 1,
          messagesSent: { $ifNull: ['$statsDoc.messagesSent', 0] },
        }
      },
      { $sort: { [effectiveSort]: sortOrder, wallet: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const data = await User.aggregate(pipeline).allowDiskUse(true);

    return res.status(200).json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
      }
    });
  } catch (error) {
    console.error('❌ [stats:admin] listUsers failed:', error?.message || error);
    return res.status(500).json({ error: 'FAILED_TO_LIST_USERS', message: error?.message || 'Internal error' });
  }
}

export default { listUsers };

