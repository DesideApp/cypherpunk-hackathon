import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import User from '#modules/users/models/user.model.js';
import Stats from '#modules/stats/models/stats.model.js';

const DEFAULT_BUCKET_MINUTES = 5;
const DEFAULT_BUCKET_COUNT = 12;
const MAX_BUCKET_MINUTES = 24 * 60;
const MAX_BUCKET_COUNT = 288;

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit'
});

const PERIOD_DEFINITIONS = {
  '1h': { minutes: 60, label: 'Last hour', defaultBucketMinutes: 5 },
  '1d': { minutes: 24 * 60, label: 'Last 24 hours', defaultBucketMinutes: 30 },
  '7d': { minutes: 7 * 24 * 60, label: 'Last 7 days', defaultBucketMinutes: 120 },
  '30d': { minutes: 30 * 24 * 60, label: 'Last 30 days', defaultBucketMinutes: 720 },
  '90d': { minutes: 90 * 24 * 60, label: 'Last 90 days', defaultBucketMinutes: 1440 }
};

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return Math.min(Math.max(parsed, min), max);
  }
  return fallback;
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildCreatedAtFilter = (from, to) => {
  const range = {};
  if (from) range.$gte = from;
  if (to) range.$lte = to;
  return Object.keys(range).length ? { createdAt: range } : {};
};

const pickDefaultBucketMinutes = (rangeMinutes) => {
  if (rangeMinutes <= 60) return 5;
  if (rangeMinutes <= 24 * 60) return 30;
  if (rangeMinutes <= 7 * 24 * 60) return 120;
  if (rangeMinutes <= 30 * 24 * 60) return 720;
  return 1440;
};

const buildBucketSeries = (startDate, bucketMinutes, bucketCount) => {
  const buckets = [];
  const startMs = startDate.getTime();
  const stepMs = bucketMinutes * 60 * 1000;

  for (let i = 0; i < bucketCount; i += 1) {
    buckets.push(new Date(startMs + i * stepMs));
  }

  return buckets;
};

const mapHistory = (buckets, countsMap, rangeEnd) => {
  return buckets.map((bucketStart) => {
    const key = bucketStart.getTime();
    const total = countsMap.get(key) ?? 0;
    const minutesAgo = Math.max(0, Math.round((rangeEnd.getTime() - key) / 60000));

    return {
      timestamp: bucketStart.toISOString(),
      label: timeFormatter.format(bucketStart),
      minutesAgo,
      value: total
    };
  });
};

// Helpers for derived stats we used to compute in the frontend
const findPeakValue = (historyArr) => {
  if (!Array.isArray(historyArr) || historyArr.length === 0) return 0;
  let peak = 0;
  for (const item of historyArr) {
    const v = Number(item?.value || 0);
    if (v > peak) peak = v;
  }
  return peak;
};

const percentileValue = (historyArr, percentile) => {
  if (!Array.isArray(historyArr) || historyArr.length === 0) return 0;
  const values = historyArr.map(h => Number(h?.value || 0)).sort((a, b) => a - b);
  const p = Math.min(100, Math.max(0, Number(percentile)));
  if (values.length === 1) return values[0];
  // Nearest-rank method
  const rank = Math.ceil((p / 100) * values.length);
  const idx = Math.min(values.length - 1, Math.max(0, rank - 1));
  return values[idx];
};

const aggregateMessageHistory = async (startDate, endDate, bucketMinutes) => {
  const match = buildCreatedAtFilter(startDate, endDate);
  const bucketsRaw = await RelayMessage.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$createdAt',
            unit: 'minute',
            binSize: bucketMinutes
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const map = new Map();
  for (const bucket of bucketsRaw) {
    const ts = new Date(bucket._id).getTime();
    map.set(ts, bucket.count);
  }
  return map;
};

const aggregateConnectionHistory = async (startDate, endDate, bucketMinutes) => {
  const match = buildCreatedAtFilter(startDate, endDate);
  const bucketsRaw = await RelayMessage.aggregate([
    { $match: match },
    {
      $project: {
        bucket: {
          $dateTrunc: {
            date: '$createdAt',
            unit: 'minute',
            binSize: bucketMinutes
          }
        },
        participants: ['$from', '$to']
      }
    },
    { $unwind: '$participants' },
    {
      $group: {
        _id: {
          bucket: '$bucket',
          wallet: '$participants'
        }
      }
    },
    {
      $group: {
        _id: '$_id.bucket',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const map = new Map();
  for (const bucket of bucketsRaw) {
    const ts = new Date(bucket._id).getTime();
    map.set(ts, bucket.count);
  }
  return map;
};

const countParticipantsSince = async (fromDate, toDate) => {
  const filter = buildCreatedAtFilter(fromDate, toDate);
  const [senders, receivers] = await Promise.all([
    RelayMessage.distinct('from', filter),
    RelayMessage.distinct('to', filter)
  ]);

  const set = new Set();
  for (const wallet of senders) {
    if (wallet) set.add(wallet);
  }
  for (const wallet of receivers) {
    if (wallet) set.add(wallet);
  }
  return set;
};

const countParticipantsWithLastSeenBetween = async (startDate, endDate) => {
  const results = await RelayMessage.aggregate([
    {
      $project: {
        createdAt: 1,
        participants: ['$from', '$to']
      }
    },
    { $unwind: '$participants' },
    {
      $group: {
        _id: '$participants',
        lastSeen: { $max: '$createdAt' }
      }
    },
    {
      $match: {
        lastSeen: { $lt: endDate, $gte: startDate }
      }
    },
    { $count: 'count' }
  ]);
  return results[0]?.count ?? 0;
};

const countNewParticipantsSince = async (startDate, endDate) => {
  const results = await RelayMessage.aggregate([
    {
      $project: {
        createdAt: 1,
        participants: ['$from', '$to']
      }
    },
    { $unwind: '$participants' },
    {
      $group: {
        _id: '$participants',
        firstSeen: { $min: '$createdAt' }
      }
    },
    {
      $match: {
        firstSeen: {
          ...(startDate ? { $gte: startDate } : {}),
          ...(endDate ? { $lte: endDate } : {})
        }
      }
    },
    { $count: 'count' }
  ]);
  return results[0]?.count ?? 0;
};

const aggregateCounters = async () => {
  const [row] = await Stats.aggregate([
    {
      $group: {
        _id: null,
        tokensAdded: { $sum: '$tokensAdded' },
        blinkMetadataHits: { $sum: '$blinkMetadataHits' },
        blinkExecutes: { $sum: '$blinkExecutes' },
        blinkVolume: { $sum: '$blinkVolume' },
        naturalCommandsParsed: { $sum: '$naturalCommandsParsed' },
        naturalCommandsExecuted: { $sum: '$naturalCommandsExecuted' },
        naturalCommandsRejected: { $sum: '$naturalCommandsRejected' },
        naturalCommandsFailed: { $sum: '$naturalCommandsFailed' },
        dmStarted: { $sum: '$dmStarted' },
        dmAccepted: { $sum: '$dmAccepted' },
        relayMessages: { $sum: '$relayMessages' }
      }
    }
  ]);
  return row || {
    tokensAdded: 0,
    blinkMetadataHits: 0,
    blinkExecutes: 0,
    blinkVolume: 0,
    naturalCommandsParsed: 0,
    naturalCommandsExecuted: 0,
    naturalCommandsRejected: 0,
    naturalCommandsFailed: 0,
    dmStarted: 0,
    dmAccepted: 0,
    relayMessages: 0
  };
};

const countEventsInRange = async (type, startDate, endDate) => {
  const match = { 'events.type': type };
  if (startDate || endDate) {
    match['events.timestamp'] = {};
    if (startDate) match['events.timestamp'].$gte = startDate;
    if (endDate) match['events.timestamp'].$lte = endDate;
  }

  const [row] = await Stats.aggregate([
    { $unwind: '$events' },
    { $match: match },
    { $group: { _id: null, total: { $sum: 1 } } }
  ]);

  return row?.total ?? 0;
};

const sumEventFieldInRange = async (type, field, startDate, endDate) => {
  const match = { 'events.type': type };
  if (startDate || endDate) {
    match['events.timestamp'] = {};
    if (startDate) match['events.timestamp'].$gte = startDate;
    if (endDate) match['events.timestamp'].$lte = endDate;
  }

  const [row] = await Stats.aggregate([
    { $unwind: '$events' },
    { $match: match },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $ifNull: [`$events.data.${field}`, 0]
          }
        }
      }
    }
  ]);

  return row?.total ?? 0;
};

// Approximate percentile of latency from Stats.events histogram (bucketAuto)
async function computeLatencyPercentile(eventType, percentile, startDate, endDate) {
  const match = { 'events.type': eventType };
  if (startDate || endDate) {
    match['events.timestamp'] = {};
    if (startDate) match['events.timestamp'].$gte = startDate;
    if (endDate) match['events.timestamp'].$lte = endDate;
  }
  match['events.data.latencyMs'] = { $gte: 0 };

  const buckets = await Stats.aggregate([
    { $unwind: '$events' },
    { $match: match },
    { $bucketAuto: { groupBy: '$events.data.latencyMs', buckets: 40 } },
    { $project: { _id: 0, min: '$_id.min', max: '$_id.max', count: 1 } },
    { $sort: { min: 1 } }
  ]);
  if (!buckets.length) return 0;
  const total = buckets.reduce((s, b) => s + (b.count || 0), 0);
  if (!total) return 0;
  const target = Math.ceil((Math.min(100, Math.max(0, percentile)) / 100) * total);
  let acc = 0;
  for (const b of buckets) {
    acc += b.count || 0;
    if (acc >= target) return Math.round(b.max || 0);
  }
  return Math.round(buckets[buckets.length - 1].max || 0);
}

export const computeStatsOverview = async (options = {}) => {
  const now = new Date();
  const rangeEnd = normalizeDate(options.rangeEnd) || now;

  if (rangeEnd > now) {
    rangeEnd.setTime(now.getTime());
  }

  let periodKey = typeof options.period === 'string' ? options.period.toLowerCase() : '1d';
  let rangeStart = normalizeDate(options.rangeStart);

  if (rangeStart && rangeStart >= rangeEnd) {
    throw new Error('Invalid range: rangeStart must be before rangeEnd');
  }

  let rangeMinutes;
  if (rangeStart) {
    rangeMinutes = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 60000));
    if (!PERIOD_DEFINITIONS[periodKey]) {
      periodKey = 'custom';
    }
  } else {
    if (!PERIOD_DEFINITIONS[periodKey]) {
      periodKey = '1d';
    }
    rangeMinutes = PERIOD_DEFINITIONS[periodKey].minutes;
    rangeStart = new Date(rangeEnd.getTime() - rangeMinutes * 60 * 1000);
  }

  const defaultBucketMinutes = clampNumber(
    PERIOD_DEFINITIONS[periodKey]?.defaultBucketMinutes,
    1,
    MAX_BUCKET_MINUTES,
    pickDefaultBucketMinutes(rangeMinutes)
  );

  const requestedBucketMinutes = clampNumber(
    options.bucketMinutes,
    1,
    MAX_BUCKET_MINUTES,
    defaultBucketMinutes
  );

  let bucketMinutes = Math.max(1, Math.min(requestedBucketMinutes, MAX_BUCKET_MINUTES));
  let defaultBucketCount = Math.max(1, Math.ceil(rangeMinutes / bucketMinutes));

  if (defaultBucketCount > MAX_BUCKET_COUNT) {
    bucketMinutes = Math.max(1, Math.min(MAX_BUCKET_MINUTES, Math.ceil(rangeMinutes / MAX_BUCKET_COUNT)));
    defaultBucketCount = Math.max(1, Math.ceil(rangeMinutes / bucketMinutes));
  }

  let bucketCount = options.bucketCount
    ? clampNumber(options.bucketCount, 1, MAX_BUCKET_COUNT, defaultBucketCount)
    : Math.min(defaultBucketCount, MAX_BUCKET_COUNT);

  const bucketMs = bucketMinutes * 60 * 1000;
  const bucketSeriesStart = new Date(Math.floor(rangeStart.getTime() / bucketMs) * bucketMs);
  const requiredCount = Math.max(1, Math.ceil((rangeEnd.getTime() - bucketSeriesStart.getTime()) / bucketMs));
  if (bucketCount < requiredCount) {
    bucketCount = Math.min(MAX_BUCKET_COUNT, requiredCount);
  }

  const buckets = buildBucketSeries(bucketSeriesStart, bucketMinutes, bucketCount);
  const last24hStart = new Date(rangeEnd.getTime() - 24 * 60 * 60 * 1000);

  const [
    messageHistoryMap,
    connectionHistoryMap,
    messagesLastMinute,
    messagesLastHour,
    messagesToday,
    counters,
    tokensAdded24h,
    blinkMetadataHits24h,
    blinkExecutes24h,
    blinkVolume24h,
    naturalCommandsParsed24h,
    naturalCommandsExecuted24h,
    naturalCommandsRejected24h,
    naturalCommandsFailed24h,
    dmStarted24h,
    dmAccepted24h,
    relayMessages24h,
    deliveredCount,
    ackedCount,
    deliveryP50,
    deliveryP95,
    ackP50,
    ackP95
  ] = await Promise.all([
    aggregateMessageHistory(rangeStart, rangeEnd, bucketMinutes),
    aggregateConnectionHistory(rangeStart, rangeEnd, bucketMinutes),
    RelayMessage.countDocuments({
      createdAt: {
        $gte: new Date(rangeEnd.getTime() - 60 * 1000),
        $lte: rangeEnd
      }
    }),
    RelayMessage.countDocuments({
      createdAt: {
        $gte: new Date(rangeEnd.getTime() - 60 * 60 * 1000),
        $lte: rangeEnd
      }
    }),
    RelayMessage.countDocuments({
      createdAt: {
        $gte: new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()),
        $lte: rangeEnd
      }
    }),
    aggregateCounters(),
    countEventsInRange('token_added', last24hStart, rangeEnd),
    countEventsInRange('blink_metadata_hit', last24hStart, rangeEnd),
    countEventsInRange('blink_execute', last24hStart, rangeEnd),
    sumEventFieldInRange('blink_execute', 'volume', last24hStart, rangeEnd),
    countEventsInRange('natural_command_parsed', last24hStart, rangeEnd),
    countEventsInRange('natural_command_executed', last24hStart, rangeEnd),
    countEventsInRange('natural_command_rejected', last24hStart, rangeEnd),
    countEventsInRange('natural_command_failed', last24hStart, rangeEnd),
    countEventsInRange('dm_started', last24hStart, rangeEnd),
    countEventsInRange('dm_accepted', last24hStart, rangeEnd),
    countEventsInRange('relay_message', last24hStart, rangeEnd),
    countEventsInRange('relay_delivered', rangeStart, rangeEnd),
    countEventsInRange('relay_acked', rangeStart, rangeEnd),
    computeLatencyPercentile('relay_delivered', 50, rangeStart, rangeEnd),
    computeLatencyPercentile('relay_delivered', 95, rangeStart, rangeEnd),
    computeLatencyPercentile('relay_acked', 50, rangeStart, rangeEnd),
    computeLatencyPercentile('relay_acked', 95, rangeStart, rangeEnd)
  ]);

  const messageHistory = mapHistory(buckets, messageHistoryMap, rangeEnd);
  const connectionHistory = mapHistory(buckets, connectionHistoryMap, rangeEnd);

  const messageTotal = messageHistory.reduce((sum, entry) => sum + entry.value, 0);
  const connectionTotal = connectionHistory.reduce((sum, entry) => sum + entry.value, 0);
  const peakConnections = connectionHistory.reduce((max, entry) => Math.max(max, entry.value), 0);
  const peakMessages = messageHistory.reduce((max, entry) => Math.max(max, entry.value), 0);

  // Derivatives commonly consumed by the admin UI
  const avgMessagesPerBucket = messageHistory.length === 0
    ? 0
    : Math.round(messageTotal / messageHistory.length);
  const avgConnectionsPerBucket = connectionHistory.length === 0
    ? 0
    : Math.round(connectionHistory.reduce((sum, item) => sum + item.value, 0) / connectionHistory.length);
  const p95Messages = percentileValue(messageHistory, 95);
  const p95Connections = percentileValue(connectionHistory, 95);

  const activeThreshold = new Date(rangeEnd.getTime() - 5 * 60 * 1000);
  const hourAgo = new Date(rangeEnd.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(rangeEnd.getTime() - 24 * 60 * 60 * 1000);
  const startOfDay = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

  const [
    participantsLastFive,
    participantsLastHour,
    newConnectionsToday,
    disconnectedRecently,
    participantsInRange
  ] = await Promise.all([
    countParticipantsSince(activeThreshold, rangeEnd),
    countParticipantsSince(hourAgo, rangeEnd),
    countNewParticipantsSince(startOfDay, rangeEnd),
    countParticipantsWithLastSeenBetween(dayAgo, hourAgo),
    countParticipantsSince(rangeStart, rangeEnd)
  ]);

  const activeConnections = participantsLastFive.size;
  const recentConnections = participantsLastHour.size;
  const disconnections = Math.max(
    0,
    recentConnections - activeConnections,
    disconnectedRecently
  );

  const avgActiveConnections =
    connectionHistory.length === 0
      ? 0
      : Math.round(
          connectionHistory.reduce((sum, item) => sum + item.value, 0) /
            connectionHistory.length
        );

  const dau = await User.countDocuments({
    lastLogin: {
      $gte: startOfDay,
      $lte: rangeEnd
    }
  });

  const blinkSuccessRate24h = blinkMetadataHits24h > 0
    ? Number(((blinkExecutes24h / blinkMetadataHits24h) * 100).toFixed(2))
    : null;
  const blinkVolume24hValue = Number(blinkVolume24h) || 0;

  return {
    generatedAt: rangeEnd.toISOString(),
    period: {
      key: periodKey,
      label: PERIOD_DEFINITIONS[periodKey]?.label || 'Custom range',
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
      minutes: rangeMinutes
    },
    bucket: {
      minutes: bucketMinutes,
      count: bucketCount
    },
    messages: {
      lastMinute: messagesLastMinute,
      lastHour: messagesLastHour,
      today: messagesToday,
      total: messageTotal,
      history: messageHistory,
      deliveryLatencyP50: deliveryP50,
      deliveryLatencyP95: deliveryP95,
      ackLatencyP50: ackP50,
      ackLatencyP95: ackP95,
      ackRate: deliveredCount > 0 ? Number(((ackedCount / deliveredCount) * 100).toFixed(2)) : null,
      // Derived values (moved from UI for consistency)
      peak: peakMessages,
      p95: p95Messages,
      avgPerBucket: avgMessagesPerBucket
    },
    connections: {
      active: activeConnections,
      activeLastHour: recentConnections,
      newToday: newConnectionsToday,
      disconnections,
      peak24h: peakConnections,
      avgActive: avgActiveConnections,
      // Derived across the selected range
      peak: peakConnections,
      p95: p95Connections,
      avgPerBucket: avgConnectionsPerBucket,
      uniqueParticipants: participantsInRange.size,
      totalInteractions: connectionTotal,
      dau,
      history: connectionHistory
    },
    productInsights: {
      tokens: {
        total: counters.tokensAdded || 0,
        last24h: tokensAdded24h
      },
      blinks: {
        metadataHits: counters.blinkMetadataHits || 0,
        metadataHits24h: blinkMetadataHits24h,
        executes: counters.blinkExecutes || 0,
        executes24h: blinkExecutes24h,
        successRate24h: blinkSuccessRate24h,
        volumeTotal: counters.blinkVolume || 0,
        volume24h: Number(blinkVolume24hValue.toFixed(4))
      },
      naturalCommands: {
        parsed: counters.naturalCommandsParsed || 0,
        executed: counters.naturalCommandsExecuted || 0,
        rejected: counters.naturalCommandsRejected || 0,
        failed: counters.naturalCommandsFailed || 0,
        parsed24h: naturalCommandsParsed24h,
        executed24h: naturalCommandsExecuted24h,
        rejected24h: naturalCommandsRejected24h,
        failed24h: naturalCommandsFailed24h
      },
      messaging: {
        dmStarted: counters.dmStarted || 0,
        dmAccepted: counters.dmAccepted || 0,
        relayMessages: counters.relayMessages || 0,
        dmStarted24h,
        dmAccepted24h,
        relayMessages24h
      }
    }
  };
};
