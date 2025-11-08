// src/modules/stats/controllers/adminActions.controller.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced MongoDB aggregations
// with $lookup joins and complex grouping. Full implementation available
// in private repository.

import Stats from '#modules/stats/models/stats.model.js';
import { ACTION_EVENT } from '#modules/actions/services/actionEvents.service.js';

const DEFAULT_LIMIT = 8;

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveRange(query) {
  const now = new Date();
  const to = parseDate(query.to || query.rangeEnd) || now;
  let from = parseDate(query.from || query.rangeStart);
  const period = (query.period || '').toString().toLowerCase();

  if (!from) {
    switch (period) {
      case '1h': from = new Date(to.getTime() - 60 * 60 * 1000); break;
      case '7d': from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '14d': from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000); break;
      case '1d':
      default:
        from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
        break;
    }
  }

  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  return { from, to };
}

function normalizeLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, 25);
}

function normalizeNumber(value) {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function aggregateLifetimeTotals() {
  const [totals] = await Stats.aggregate([
    {
      $group: {
        _id: null,
        send: { $sum: '$actionsSend' },
        request: { $sum: '$actionsRequests' },
        buy: { $sum: '$actionsBuy' },
        agreements: { $sum: '$actionsAgreements' },
      },
    },
  ]).allowDiskUse(true);

  return totals || {
    send: 0,
    request: 0,
    buy: 0,
    agreements: 0,
  };
}

async function aggregateSummary(from, to) {
  const summaryTypes = [
    ACTION_EVENT.SEND,
    ACTION_EVENT.SEND_FAILED,
    ACTION_EVENT.REQUEST_CREATED,
    ACTION_EVENT.REQUEST_COMPLETED,
    ACTION_EVENT.BUY,
    ACTION_EVENT.BUY_FAILED,
    ACTION_EVENT.AGREEMENT_CREATED,
    ACTION_EVENT.AGREEMENT_SIGNED,
    ACTION_EVENT.AGREEMENT_SETTLED,
  ];

  const [summary] = await Stats.aggregate([
    { $project: { events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.timestamp': { $gte: from, $lte: to },
        'events.type': { $in: summaryTypes },
      },
    },
    {
      $group: {
        _id: null,
        sendCount: {
          $sum: { $cond: [{ $eq: ['$events.type', ACTION_EVENT.SEND] }, 1, 0] },
        },
        sendVolume: {
          $sum: {
            $cond: [
              { $eq: ['$events.type', ACTION_EVENT.SEND] },
              { $ifNull: ['$events.data.amount', 0] },
              0,
            ],
          },
        },
        requestCount: {
          $sum: { $cond: [{ $eq: ['$events.type', ACTION_EVENT.REQUEST_CREATED] }, 1, 0] },
        },
        requestAmount: {
          $sum: {
            $cond: [
              { $eq: ['$events.type', ACTION_EVENT.REQUEST_CREATED] },
              { $ifNull: ['$events.data.amount', 0] },
              0,
            ],
          },
        },
        buyCount: {
          $sum: { $cond: [{ $eq: ['$events.type', ACTION_EVENT.BUY] }, 1, 0] },
        },
        buyVolume: {
          $sum: {
            $cond: [
              { $eq: ['$events.type', ACTION_EVENT.BUY] },
              { $ifNull: ['$events.data.volume', 0] },
              0,
            ],
          },
        },
        agreementCreated: {
          $sum: { $cond: [{ $eq: ['$events.type', ACTION_EVENT.AGREEMENT_CREATED] }, 1, 0] },
        },
        agreementSigned: {
          $sum: { $cond: [{ $eq: ['$events.type', ACTION_EVENT.AGREEMENT_SIGNED] }, 1, 0] },
        },
        agreementSettled: {
          $sum: { $cond: [{ $eq: ['$events.type', ACTION_EVENT.AGREEMENT_SETTLED] }, 1, 0] },
        },
      },
    },
  ]).allowDiskUse(true);

  return summary || {
    sendCount: 0,
    sendVolume: 0,
    requestCount: 0,
    requestAmount: 0,
    buyCount: 0,
    buyVolume: 0,
    agreementCreated: 0,
    agreementSigned: 0,
    agreementSettled: 0,
  };
}

async function aggregateTopSenders(from, to, limit) {
  const pipeline = [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: 'wallet',
        as: 'userDoc',
      },
    },
    { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    { $project: { user: 1, nickname: '$userDoc.nickname', events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': ACTION_EVENT.SEND,
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$events.data.amount', 0] } },
        tokens: {
          $addToSet: {
            $cond: [{ $ifNull: ['$events.data.token', false] }, '$events.data.token', '$$REMOVE'],
          },
        },
        lastAt: { $max: '$events.timestamp' },
      },
    },
    { $sort: { count: -1, totalAmount: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    wallet: row._id,
    nickname: row.nickname || null,
    count: row.count || 0,
    totalAmount: Number((row.totalAmount || 0).toFixed(4)),
    avgAmount:
      row.count > 0 ? Number(((row.totalAmount || 0) / row.count).toFixed(4)) : null,
    tokens: (row.tokens || []).filter(Boolean),
    lastAt: row.lastAt || null,
  }));
}

async function aggregateSendTokens(from, to, limit) {
  const pipeline = [
    { $project: { events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': ACTION_EVENT.SEND,
        'events.timestamp': { $gte: from, $lte: to },
        'events.data.token': { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$events.data.token',
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$events.data.amount', 0] } },
      },
    },
    { $sort: { count: -1, totalAmount: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    token: row._id || 'UNKNOWN',
    count: row.count || 0,
    totalAmount: Number((row.totalAmount || 0).toFixed(4)),
  }));
}

async function aggregateTopRequesters(from, to, limit) {
  const pipeline = [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: 'wallet',
        as: 'userDoc',
      },
    },
    { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    { $project: { user: 1, nickname: '$userDoc.nickname', events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': ACTION_EVENT.REQUEST_CREATED,
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        count: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$events.data.amount', 0] } },
        tokens: {
          $addToSet: {
            $cond: [{ $ifNull: ['$events.data.token', false] }, '$events.data.token', '$$REMOVE'],
          },
        },
        lastAt: { $max: '$events.timestamp' },
      },
    },
    { $sort: { count: -1, totalAmount: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    wallet: row._id,
    nickname: row.nickname || null,
    count: row.count || 0,
    totalAmount: Number((row.totalAmount || 0).toFixed(4)),
    avgAmount:
      row.count > 0 ? Number(((row.totalAmount || 0) / row.count).toFixed(4)) : null,
    tokens: (row.tokens || []).filter(Boolean),
    lastAt: row.lastAt || null,
  }));
}

async function aggregateTopBuyers(from, to, limit) {
  const pipeline = [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: 'wallet',
        as: 'userDoc',
      },
    },
    { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    { $project: { user: 1, nickname: '$userDoc.nickname', events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': ACTION_EVENT.BUY,
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        count: { $sum: 1 },
        totalVolume: { $sum: { $ifNull: ['$events.data.volume', 0] } },
        totalAmountSol: { $sum: { $ifNull: ['$events.data.amountInSol', 0] } },
        tokens: {
          $addToSet: {
            $cond: [{ $ifNull: ['$events.data.token', false] }, '$events.data.token', '$$REMOVE'],
          },
        },
        lastAt: { $max: '$events.timestamp' },
      },
    },
    { $sort: { count: -1, totalVolume: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    wallet: row._id,
    nickname: row.nickname || null,
    count: row.count || 0,
    totalVolume: Number((row.totalVolume || 0).toFixed(4)),
    totalAmountSol: Number((row.totalAmountSol || 0).toFixed(4)),
    tokens: (row.tokens || []).filter(Boolean),
    lastAt: row.lastAt || null,
  }));
}

async function aggregateBuyTokens(from, to, limit) {
  const pipeline = [
    { $project: { events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': ACTION_EVENT.BUY,
        'events.timestamp': { $gte: from, $lte: to },
        'events.data.token': { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$events.data.token',
        count: { $sum: 1 },
        totalVolume: { $sum: { $ifNull: ['$events.data.volume', 0] } },
      },
    },
    { $sort: { count: -1, totalVolume: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    token: row._id || 'UNKNOWN',
    count: row.count || 0,
    totalVolume: Number((row.totalVolume || 0).toFixed(4)),
  }));
}

async function aggregateAgreementCreators(from, to, limit) {
  const pipeline = [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: 'wallet',
        as: 'userDoc',
      },
    },
    { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    { $project: { user: 1, nickname: '$userDoc.nickname', events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': ACTION_EVENT.AGREEMENT_CREATED,
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        count: { $sum: 1 },
        counterparts: {
          $addToSet: {
            $cond: [
              { $ifNull: ['$events.data.counterparty', false] },
              '$events.data.counterparty',
              '$$REMOVE',
            ],
          },
        },
        lastAt: { $max: '$events.timestamp' },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    wallet: row._id,
    nickname: row.nickname || null,
    count: row.count || 0,
    counterparts: (row.counterparts || []).filter(Boolean),
    lastAt: row.lastAt || null,
  }));
}

async function aggregateAgreementSigners(from, to, limit) {
  const pipeline = [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: 'wallet',
        as: 'userDoc',
      },
    },
    { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    { $project: { user: 1, nickname: '$userDoc.nickname', events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': ACTION_EVENT.AGREEMENT_SIGNED,
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        count: { $sum: 1 },
        byStage: {
          $push: '$events.data.stage',
        },
        lastAt: { $max: '$events.timestamp' },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    wallet: row._id,
    nickname: row.nickname || null,
    count: row.count || 0,
    stages: row.byStage?.filter(Boolean) || [],
    lastAt: row.lastAt || null,
  }));
}

async function aggregateAgreementSettlements(from, to, limit) {
  const pipeline = [
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: 'wallet',
        as: 'userDoc',
      },
    },
    { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    { $project: { user: 1, nickname: '$userDoc.nickname', events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': ACTION_EVENT.AGREEMENT_SETTLED,
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        count: { $sum: 1 },
        lastAt: { $max: '$events.timestamp' },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    wallet: row._id,
    nickname: row.nickname || null,
    count: row.count || 0,
    lastAt: row.lastAt || null,
  }));
}

export async function getActionsOverview(req, res) {
  try {
    const { from, to } = resolveRange(req.query);
    const limit = normalizeLimit(req.query.limit || DEFAULT_LIMIT);

    const [
      lifetime,
      summary,
      senders,
      sendTokens,
      requesters,
      buyers,
      buyTokens,
      agreementCreators,
      agreementSigners,
      agreementSettlements,
    ] = await Promise.all([
      aggregateLifetimeTotals(),
      aggregateSummary(from, to),
      aggregateTopSenders(from, to, limit),
      aggregateSendTokens(from, to, limit),
      aggregateTopRequesters(from, to, limit),
      aggregateTopBuyers(from, to, limit),
      aggregateBuyTokens(from, to, limit),
      aggregateAgreementCreators(from, to, limit),
      aggregateAgreementSigners(from, to, limit),
      aggregateAgreementSettlements(from, to, limit),
    ]);

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      range: { from: from.toISOString(), to: to.toISOString() },
      send: {
        lifetimeTotal: lifetime.send || 0,
        periodCount: summary.sendCount || 0,
        periodVolume: Number((summary.sendVolume || 0).toFixed(4)),
        topUsers: senders,
        tokens: sendTokens,
      },
      request: {
        lifetimeTotal: lifetime.request || 0,
        periodCount: summary.requestCount || 0,
        periodAmount: Number((summary.requestAmount || 0).toFixed(4)),
        topUsers: requesters,
      },
      buy: {
        lifetimeTotal: lifetime.buy || 0,
        periodCount: summary.buyCount || 0,
        periodVolume: Number((summary.buyVolume || 0).toFixed(4)),
        topUsers: buyers,
        tokens: buyTokens,
      },
      agreement: {
        lifetimeTotal: lifetime.agreements || 0,
        periodCreated: summary.agreementCreated || 0,
        periodSigned: summary.agreementSigned || 0,
        periodSettled: summary.agreementSettled || 0,
        topCreators: agreementCreators,
        topSigners: agreementSigners,
        settlements: agreementSettlements,
      },
    });
  } catch (error) {
    console.error('❌ [stats:actions] Failed to build overview', error);
    return res.status(500).json({
      error: 'FAILED_TO_FETCH_ACTIONS_OVERVIEW',
      message: error?.message || 'Internal error',
    });
  }
}

export default { getActionsOverview };
