import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import User from '#modules/users/models/user.model.js';

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

  const [
    messageHistoryMap,
    connectionHistoryMap,
    messagesLastMinute,
    messagesLastHour,
    messagesToday
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
    })
  ]);

  const messageHistory = mapHistory(buckets, messageHistoryMap, rangeEnd);
  const connectionHistory = mapHistory(buckets, connectionHistoryMap, rangeEnd);

  const messageTotal = messageHistory.reduce((sum, entry) => sum + entry.value, 0);
  const connectionTotal = connectionHistory.reduce((sum, entry) => sum + entry.value, 0);
  const peakConnections = connectionHistory.reduce((max, entry) => Math.max(max, entry.value), 0);

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
      history: messageHistory
    },
    connections: {
      active: activeConnections,
      activeLastHour: recentConnections,
      newToday: newConnectionsToday,
      disconnections,
      peak24h: peakConnections,
      avgActive: avgActiveConnections,
      uniqueParticipants: participantsInRange.size,
      totalInteractions: connectionTotal,
      dau,
      history: connectionHistory
    }
  };
};
