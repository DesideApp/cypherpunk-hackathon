import Stats from '#modules/stats/models/stats.model.js';

const DEFAULT_LIMIT = 5;

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

async function aggregateLifetimeTotals() {
  const [totals] = await Stats.aggregate([
    {
      $group: {
        _id: null,
        tokensAdded: { $sum: '$tokensAdded' },
        blinkMetadataHits: { $sum: '$blinkMetadataHits' },
        blinkExecutes: { $sum: '$blinkExecutes' },
        blinkVolume: { $sum: '$blinkVolume' },
        naturalParsed: { $sum: '$naturalCommandsParsed' },
        naturalExecuted: { $sum: '$naturalCommandsExecuted' },
        naturalRejected: { $sum: '$naturalCommandsRejected' },
        naturalFailed: { $sum: '$naturalCommandsFailed' },
      },
    },
  ]).allowDiskUse(true);
  return totals || {
    tokensAdded: 0,
    blinkMetadataHits: 0,
    blinkExecutes: 0,
    blinkVolume: 0,
    naturalParsed: 0,
    naturalExecuted: 0,
    naturalRejected: 0,
    naturalFailed: 0,
  };
}

async function aggregateSummary(from, to) {
  const summaryTypes = [
    'token_added',
    'blink_metadata_hit',
    'blink_execute',
    'blink_execute_failed',
    'natural_command_parsed',
    'natural_command_executed',
    'natural_command_rejected',
    'natural_command_failed',
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
        tokensAdded24h: {
          $sum: { $cond: [{ $eq: ['$events.type', 'token_added'] }, 1, 0] },
        },
        blinkMetadataHits24h: {
          $sum: { $cond: [{ $eq: ['$events.type', 'blink_metadata_hit'] }, 1, 0] },
        },
        blinkExecutes24h: {
          $sum: { $cond: [{ $eq: ['$events.type', 'blink_execute'] }, 1, 0] },
        },
        blinkFailures24h: {
          $sum: { $cond: [{ $eq: ['$events.type', 'blink_execute_failed'] }, 1, 0] },
        },
        blinkVolume24h: {
          $sum: {
            $cond: [
              { $eq: ['$events.type', 'blink_execute'] },
              { $ifNull: ['$events.data.volume', 0] },
              0,
            ],
          },
        },
        naturalParsed24h: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_parsed'] }, 1, 0] },
        },
        naturalExecuted24h: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_executed'] }, 1, 0] },
        },
        naturalRejected24h: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_rejected'] }, 1, 0] },
        },
        naturalFailed24h: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_failed'] }, 1, 0] },
        },
      },
    },
  ]).allowDiskUse(true);

  return summary || {
    tokensAdded24h: 0,
    blinkMetadataHits24h: 0,
    blinkExecutes24h: 0,
    blinkFailures24h: 0,
    blinkVolume24h: 0,
    naturalParsed24h: 0,
    naturalExecuted24h: 0,
    naturalRejected24h: 0,
    naturalFailed24h: 0,
  };
}

async function aggregateTokenTopUsers(from, to, limit) {
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
        'events.type': 'token_added',
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        count: { $sum: 1 },
        lastAt: { $max: '$events.timestamp' },
        tokens: {
          $addToSet: {
            $cond: [
              { $ifNull: ['$events.data.code', false] },
              '$events.data.code',
              '$$REMOVE',
            ],
          },
        },
        mints: {
          $addToSet: {
            $cond: [
              { $ifNull: ['$events.data.mint', false] },
              '$events.data.mint',
              '$$REMOVE',
            ],
          },
        },
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
    tokens: (row.tokens || []).filter(Boolean),
    mints: (row.mints || []).filter(Boolean),
  }));
}

async function aggregateTokenTopCodes(from, to, limit) {
  const pipeline = [
    { $project: { events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': 'token_added',
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: {
          code: '$events.data.code',
          mint: '$events.data.mint',
        },
        count: { $sum: 1 },
        users: { $addToSet: '$user' },
        lastAt: { $max: '$events.timestamp' },
      },
    },
    { $sort: { count: -1, '_id.code': 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    code: row._id?.code || null,
    mint: row._id?.mint || null,
    count: row.count || 0,
    uniqueUsers: Array.isArray(row.users) ? row.users.length : 0,
    lastAt: row.lastAt || null,
  }));
}

async function aggregateBlinkUsers(from, to, limit) {
  const types = ['blink_metadata_hit', 'blink_execute', 'blink_execute_failed'];
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
        'events.type': { $in: types },
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        metadataHits: {
          $sum: {
            $cond: [{ $eq: ['$events.type', 'blink_metadata_hit'] }, 1, 0],
          },
        },
        executes: {
          $sum: {
            $cond: [{ $eq: ['$events.type', 'blink_execute'] }, 1, 0],
          },
        },
        failures: {
          $sum: {
            $cond: [{ $eq: ['$events.type', 'blink_execute_failed'] }, 1, 0],
          },
        },
        volume: {
          $sum: {
            $cond: [
              { $eq: ['$events.type', 'blink_execute'] },
              { $ifNull: ['$events.data.volume', 0] },
              0,
            ],
          },
        },
        tokens: {
          $addToSet: {
            $cond: [
              { $ifNull: ['$events.data.token', false] },
              '$events.data.token',
              '$$REMOVE',
            ],
          },
        },
      },
    },
    { $sort: { executes: -1, metadataHits: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => {
    const metadataHits = row.metadataHits || 0;
    const executes = row.executes || 0;
    const failures = row.failures || 0;
    const totalAttempts = metadataHits || executes + failures;
    const successRate =
      totalAttempts > 0 ? Number(((executes / totalAttempts) * 100).toFixed(2)) : null;
    const failureRate =
      totalAttempts > 0 ? Number(((failures / totalAttempts) * 100).toFixed(2)) : null;
    const volume = Number(row.volume || 0);
    const volumeAvg = executes > 0 ? Number((volume / executes).toFixed(4)) : null;

    return {
      wallet: row._id,
      nickname: row.nickname || null,
      metadataHits,
      executes,
      failures,
      successRate,
      failureRate,
      volume,
      volumeAvg,
      tokens: (row.tokens || []).filter(Boolean),
    };
  });
}

async function aggregateBlinkTokens(from, to, limit) {
  const types = ['blink_metadata_hit', 'blink_execute', 'blink_execute_failed'];
  const pipeline = [
    { $project: { events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.timestamp': { $gte: from, $lte: to },
        'events.type': { $in: types },
        'events.data.token': { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$events.data.token',
        metadataHits: {
          $sum: {
            $cond: [{ $eq: ['$events.type', 'blink_metadata_hit'] }, 1, 0],
          },
        },
        executes: {
          $sum: {
            $cond: [{ $eq: ['$events.type', 'blink_execute'] }, 1, 0],
          },
        },
        failures: {
          $sum: {
            $cond: [{ $eq: ['$events.type', 'blink_execute_failed'] }, 1, 0],
          },
        },
        volume: {
          $sum: {
            $cond: [
              { $eq: ['$events.type', 'blink_execute'] },
              { $ifNull: ['$events.data.volume', 0] },
              0,
            ],
          },
        },
      },
    },
    { $sort: { executes: -1, metadataHits: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => {
    const metadataHits = row.metadataHits || 0;
    const executes = row.executes || 0;
    const failures = row.failures || 0;
    const totalAttempts = metadataHits || executes + failures;
    const successRate =
      totalAttempts > 0 ? Number(((executes / totalAttempts) * 100).toFixed(2)) : null;
    const volume = Number(row.volume || 0);
    const volumeAvg = executes > 0 ? Number((volume / executes).toFixed(4)) : null;
    return {
      token: row._id || null,
      metadataHits,
      executes,
      failures,
      successRate,
      volume,
      volumeAvg,
    };
  });
}

async function aggregateBlinkFailures(from, to, limit) {
  const pipeline = [
    { $project: { events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': 'blink_execute_failed',
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$events.data.error',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => ({
    reason: row._id || 'unknown',
    count: row.count || 0,
  }));
}

async function aggregateNaturalUsers(from, to, limit) {
  const types = [
    'natural_command_parsed',
    'natural_command_executed',
    'natural_command_rejected',
    'natural_command_failed',
  ];
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
        'events.type': { $in: types },
        'events.timestamp': { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$user',
        nickname: { $first: '$nickname' },
        parsed: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_parsed'] }, 1, 0] },
        },
        executed: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_executed'] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_rejected'] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_failed'] }, 1, 0] },
        },
      },
    },
    { $sort: { executed: -1, parsed: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => {
    const parsed = row.parsed || 0;
    const executed = row.executed || 0;
    const effectiveParsed = Math.max(0, parsed - (row.rejected || 0));
    const successRate =
      (effectiveParsed > 0
        ? Number(((executed / effectiveParsed) * 100).toFixed(2))
        : parsed > 0
          ? Number(((executed / parsed) * 100).toFixed(2))
          : null);
    const failureRate =
      parsed > 0 ? Number(((row.failed || 0) / parsed * 100).toFixed(2)) : null;
    const rejectRate =
      parsed > 0 ? Number(((row.rejected || 0) / parsed * 100).toFixed(2)) : null;

    return {
      wallet: row._id,
      nickname: row.nickname || null,
      parsed,
      executed,
      rejected: row.rejected || 0,
      failed: row.failed || 0,
      successRate,
      failureRate,
      rejectRate,
    };
  });
}

async function aggregateNaturalActions(from, to, limit) {
  const types = [
    'natural_command_parsed',
    'natural_command_executed',
    'natural_command_rejected',
    'natural_command_failed',
  ];
  const pipeline = [
    { $project: { events: 1 } },
    { $unwind: '$events' },
    {
      $match: {
        'events.type': { $in: types },
        'events.timestamp': { $gte: from, $lte: to },
        'events.data.action': { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$events.data.action',
        parsed: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_parsed'] }, 1, 0] },
        },
        executed: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_executed'] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_rejected'] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$events.type', 'natural_command_failed'] }, 1, 0] },
        },
      },
    },
    { $sort: { executed: -1, parsed: -1, _id: 1 } },
    { $limit: limit },
  ];

  const rows = await Stats.aggregate(pipeline).allowDiskUse(true);
  return rows.map((row) => {
    const parsed = row.parsed || 0;
    const executed = row.executed || 0;
    const effectiveParsed = Math.max(0, parsed - (row.rejected || 0));
    const successRate =
      (effectiveParsed > 0
        ? Number(((executed / effectiveParsed) * 100).toFixed(2))
        : parsed > 0
          ? Number(((executed / parsed) * 100).toFixed(2))
          : null);
    const failureRate =
      parsed > 0 ? Number(((row.failed || 0) / parsed * 100).toFixed(2)) : null;
    const rejectRate =
      parsed > 0 ? Number(((row.rejected || 0) / parsed * 100).toFixed(2)) : null;

    return {
      action: row._id,
      parsed,
      executed,
      rejected: row.rejected || 0,
      failed: row.failed || 0,
      successRate,
      failureRate,
      rejectRate,
    };
  });
}

export async function getActionsOverview(req, res) {
  try {
    const { from, to } = resolveRange(req.query);
    const limit = normalizeLimit(req.query.limit || DEFAULT_LIMIT);

    const [
      lifetimeTotals,
      summary24h,
      tokenTopUsers,
      tokenTopCodes,
      blinkUsers,
      blinkTokens,
      blinkFailures,
      naturalUsers,
      naturalActions,
    ] = await Promise.all([
      aggregateLifetimeTotals(),
      aggregateSummary(from, to),
      aggregateTokenTopUsers(from, to, limit),
      aggregateTokenTopCodes(from, to, limit),
      aggregateBlinkUsers(from, to, limit),
      aggregateBlinkTokens(from, to, limit),
      aggregateBlinkFailures(from, to, limit),
      aggregateNaturalUsers(from, to, limit),
      aggregateNaturalActions(from, to, limit),
    ]);

    const blinkSuccessRate24h =
      summary24h.blinkMetadataHits24h > 0
        ? Number(((summary24h.blinkExecutes24h / summary24h.blinkMetadataHits24h) * 100).toFixed(2))
        : summary24h.blinkExecutes24h > 0
          ? 100
          : null;

    const blinkVolumeAvg24h =
      summary24h.blinkExecutes24h > 0
        ? Number((summary24h.blinkVolume24h / summary24h.blinkExecutes24h).toFixed(4))
        : null;

    const naturalSuccessRate24h = (() => {
      const effectiveParsed = Math.max(
        0,
        summary24h.naturalParsed24h - summary24h.naturalRejected24h,
      );
      if (effectiveParsed > 0) {
        return Number(((summary24h.naturalExecuted24h / effectiveParsed) * 100).toFixed(2));
      }
      if (summary24h.naturalParsed24h > 0) {
        return Number(((summary24h.naturalExecuted24h / summary24h.naturalParsed24h) * 100).toFixed(2));
      }
      return null;
    })();

    const naturalFailureRate24h =
      summary24h.naturalParsed24h > 0
        ? Number(((summary24h.naturalFailed24h / summary24h.naturalParsed24h) * 100).toFixed(2))
        : null;
    const naturalRejectRate24h =
      summary24h.naturalParsed24h > 0
        ? Number(((summary24h.naturalRejected24h / summary24h.naturalParsed24h) * 100).toFixed(2))
        : null;

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      tokens: {
        lifetimeTotal: lifetimeTotals.tokensAdded || 0,
        last24h: summary24h.tokensAdded24h || 0,
        topUsers24h: tokenTopUsers,
        topTokens24h: tokenTopCodes,
      },
      blinks: {
        metadataHits24h: summary24h.blinkMetadataHits24h || 0,
        executes24h: summary24h.blinkExecutes24h || 0,
        failures24h: {
          total: summary24h.blinkFailures24h || 0,
          byReason: blinkFailures,
        },
        volume24h: summary24h.blinkVolume24h || 0,
        volumeAvg24h: blinkVolumeAvg24h,
        successRate24h: blinkSuccessRate24h,
        topUsers24h: blinkUsers,
        topTokens24h: blinkTokens,
      },
      natural: {
        parsed24h: summary24h.naturalParsed24h || 0,
        executed24h: summary24h.naturalExecuted24h || 0,
        rejected24h: summary24h.naturalRejected24h || 0,
        failed24h: summary24h.naturalFailed24h || 0,
        successRate24h: naturalSuccessRate24h,
        failureRate24h: naturalFailureRate24h,
        rejectRate24h: naturalRejectRate24h,
        topUsers24h: naturalUsers,
        topActions24h: naturalActions,
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
