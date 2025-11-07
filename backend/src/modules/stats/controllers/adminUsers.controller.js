// src/modules/stats/controllers/adminUsers.controller.js
import User from '#modules/users/models/user.model.js';
import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import mongoose from 'mongoose';

function parseDateSafe(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveRange(query) {
  const now = new Date();
  const fromQ = query.from || query.rangeStart;
  const toQ = query.to || query.rangeEnd;
  const period = (query.period || '').toString().toLowerCase();

  const to = parseDateSafe(toQ) || now;
  let from = parseDateSafe(fromQ);

  if (!from) {
    switch (period) {
      case '1h': from = new Date(to.getTime() - 60 * 60 * 1000); break;
      case '7d': from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '1d':
      default:
        from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
        break;
    }
  }
  if (from > to) {
    const tmp = from; from = to; to = tmp;
  }
  return { from, to };
}

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
    const total = await User.countDocuments(filter);

    // Sorting map
    const SORT_FIELDS = new Set([
      'lastLogin',
      'registeredAt',
      'loginCount',
      'messagesSent',
      'relayUsedBytes',
      'actionsSend',
      'actionsRequests',
      'actionsBuy',
      'actionsAgreements'
    ]);
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
          actionsSend: { $ifNull: ['$statsDoc.actionsSend', 0] },
          actionsRequests: { $ifNull: ['$statsDoc.actionsRequests', 0] },
          actionsBuy: { $ifNull: ['$statsDoc.actionsBuy', 0] },
          actionsAgreements: { $ifNull: ['$statsDoc.actionsAgreements', 0] },
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

/**
 * GET /api/v1/stats/admin/users/recent-logins
 * Query: limit (default 50), search (optional)
 */
export async function listRecentLogins(req, res) {
  try {
    const limitRaw = parseInt(req.query.limit || '50', 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
    const search = (req.query.search || '').toString().trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { wallet:   { $regex: search, $options: 'i' } },
        { nickname: { $regex: search, $options: 'i' } },
      ];
    }

    const data = await User.find(filter, {
      _id: 0,
      wallet: 1,
      nickname: 1,
      role: 1,
      banned: 1,
      lastLogin: 1,
      registeredAt: 1,
      loginCount: 1,
      relayUsedBytes: 1,
      relayQuotaBytes: 1,
    }).sort({ lastLogin: -1 }).limit(limit).lean();

    return res.status(200).json({ data });
  } catch (error) {
    console.error('❌ [stats:admin] listRecentLogins failed:', error?.message || error);
    return res.status(500).json({ error: 'FAILED_TO_LIST_RECENT_LOGINS', message: error?.message || 'Internal error' });
  }
}

/**
 * GET /api/v1/stats/admin/users/top
 * Query:
 *  - metric: 'sent' | 'received' (default 'sent')
 *  - period / from / to (time range)
 *  - limit: default 20 (max 100)
 */
export async function listTopUsers(req, res) {
  try {
    const metric = (req.query.metric || 'sent').toString().toLowerCase();
    const { from, to } = resolveRange(req.query);
    const limitRaw = parseInt(req.query.limit || '20', 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

    const field = metric === 'received' ? '$to' : '$from';

    const pipeline = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: field, count: { $sum: 1 } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
      { $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'wallet',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: {
          wallet: '$_id',
          count: 1,
          nickname: '$user.nickname',
          role: '$user.role',
          lastLogin: '$user.lastLogin'
        }
      },
    ];

    const data = await RelayMessage.aggregate(pipeline).allowDiskUse(true);
    return res.status(200).json({
      data,
      range: { from: from.toISOString(), to: to.toISOString() },
      metric,
    });
  } catch (error) {
    console.error('❌ [stats:admin] listTopUsers failed:', error?.message || error);
    return res.status(500).json({ error: 'FAILED_TO_LIST_TOP_USERS', message: error?.message || 'Internal error' });
  }
}
