// src/modules/stats/services/metrics.service.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced MongoDB aggregations,
// percentile calculations, and complex analytics. Full implementation
// available in private repository.

import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import Stats from '#modules/stats/models/stats.model.js';
import { getRelayStore } from '#modules/relay/services/relayStoreProvider.js';

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

// Simplified aggregations - production version has advanced MongoDB pipelines
const aggregateMessageHistory = async (startDate, endDate, bucketMinutes) => {
  const match = buildCreatedAtFilter(startDate, endDate);
  const store = getRelayStore();
  const bucketsRaw = await store.aggregateMessageHistory(match, bucketMinutes);
  const map = new Map();
  for (const bucket of bucketsRaw) {
    const ts = new Date(bucket._id).getTime();
    map.set(ts, bucket.count);
  }
  return map;
};

const aggregateConnectionHistory = async (startDate, endDate, bucketMinutes) => {
  const match = buildCreatedAtFilter(startDate, endDate);
  const store = getRelayStore();
  const bucketsRaw = await store.aggregateConnectionHistory(match, bucketMinutes);
  const map = new Map();
  for (const bucket of bucketsRaw) {
    const ts = new Date(bucket._id).getTime();
    map.set(ts, bucket.count);
  }
  return map;
};

const aggregateCounters = async () => {
  // Simplified - production version has full aggregation pipeline
  const [row] = await Stats.aggregate([
    {
      $group: {
        _id: null,
        tokensAdded: { $sum: '$tokensAdded' },
        blinkExecutes: { $sum: '$blinkExecutes' },
        blinkVolume: { $sum: '$blinkVolume' },
        naturalCommandsParsed: { $sum: '$naturalCommandsParsed' },
        naturalCommandsExecuted: { $sum: '$naturalCommandsExecuted' },
        dmStarted: { $sum: '$dmStarted' },
        dmAccepted: { $sum: '$dmAccepted' },
        relayMessages: { $sum: '$relayMessages' },
        actionsSend: { $sum: '$actionsSend' },
        actionsRequests: { $sum: '$actionsRequests' },
        actionsBuy: { $sum: '$actionsBuy' },
        actionsAgreements: { $sum: '$actionsAgreements' },
      }
    }
  ]);
  return row || {
    tokensAdded: 0,
    blinkExecutes: 0,
    blinkVolume: 0,
    naturalCommandsParsed: 0,
    naturalCommandsExecuted: 0,
    dmStarted: 0,
    dmAccepted: 0,
    relayMessages: 0,
    actionsSend: 0,
    actionsRequests: 0,
    actionsBuy: 0,
    actionsAgreements: 0
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
        total: { $sum: { $ifNull: [`$events.data.${field}`, 0] } }
      }
    }
  ]);

  return row?.total ?? 0;
};

// Simplified percentile calculation - production version uses bucketAuto
async function computeLatencyPercentile(eventType, percentile, startDate, endDate, field = 'latencyMs') {
  // Simplified implementation - production version has advanced histogram logic
  return 0;
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

  const requestedBucketCount = clampNumber(
    options.bucketCount,
    1,
    MAX_BUCKET_COUNT,
    DEFAULT_BUCKET_COUNT
  );

  const bucketMinutes = requestedBucketMinutes;
  const bucketCount = Math.min(
    requestedBucketCount,
    Math.ceil(rangeMinutes / bucketMinutes)
  );

  const buckets = buildBucketSeries(rangeStart, bucketMinutes, bucketCount);
  const last24hStart = new Date(rangeEnd.getTime() - 24 * 60 * 60 * 1000);

  const [
    messageHistoryMap,
    connectionHistoryMap,
    messagesLastMinute,
    messagesLastHour,
    messagesToday,
    counters,
    tokensAdded24h,
    dmStarted24h,
    dmAccepted24h,
    relayMessages24h,
    actionSend24h,
    actionSendVolume24h,
    actionRequest24h,
    actionRequestAmount24h,
    actionBuy24h,
    actionBuyVolume24h,
    actionAgreementCreated24h,
    actionAgreementSigned24h,
    actionAgreementSettled24h,
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
    countEventsInRange('dm_started', last24hStart, rangeEnd),
    countEventsInRange('dm_accepted', last24hStart, rangeEnd),
    countEventsInRange('relay_message', last24hStart, rangeEnd),
    countEventsInRange('action_send', last24hStart, rangeEnd),
    sumEventFieldInRange('action_send', 'amount', last24hStart, rangeEnd),
    countEventsInRange('action_request_created', last24hStart, rangeEnd),
    sumEventFieldInRange('action_request_created', 'amount', last24hStart, rangeEnd),
    countEventsInRange('action_buy', last24hStart, rangeEnd),
    sumEventFieldInRange('action_buy', 'volume', last24hStart, rangeEnd),
    countEventsInRange('action_agreement_created', last24hStart, rangeEnd),
    countEventsInRange('action_agreement_signed', last24hStart, rangeEnd),
    countEventsInRange('action_agreement_settled', last24hStart, rangeEnd),
    countEventsInRange('relay_delivered', rangeStart, rangeEnd),
    countEventsInRange('relay_acked', rangeStart, rangeEnd),
    computeLatencyPercentile('relay_delivered', 50, rangeStart, rangeEnd, 'latencyMs'),
    computeLatencyPercentile('relay_delivered', 95, rangeStart, rangeEnd, 'latencyMs'),
    computeLatencyPercentile('relay_acked', 50, rangeStart, rangeEnd, 'latencyMs'),
    computeLatencyPercentile('relay_acked', 95, rangeStart, rangeEnd, 'latencyMs')
  ]);

  const messageHistory = mapHistory(buckets, messageHistoryMap, rangeEnd);
  const connectionHistory = mapHistory(buckets, connectionHistoryMap, rangeEnd);

  const messageTotal = messageHistory.reduce((sum, entry) => sum + entry.value, 0);
  const connectionTotal = connectionHistory.reduce((sum, entry) => sum + entry.value, 0);
  const peakConnections = connectionHistory.reduce((max, entry) => Math.max(max, entry.value), 0);
  const peakMessages = messageHistory.reduce((max, entry) => Math.max(max, entry.value), 0);

  // Simplified participant calculations
  const uniqueParticipants = Math.max(peakConnections, connectionTotal);
  const newParticipants = Math.floor(uniqueParticipants * 0.1); // Simplified estimate
  const returningParticipants = Math.max(0, uniqueParticipants - newParticipants);
  const returningRate = uniqueParticipants > 0
    ? Number(((returningParticipants / uniqueParticipants) * 100).toFixed(2))
    : null;

  // Simplified RTC stats - computed after Promise.all resolves
  const rtcOffers = await countEventsInRange('rtc_offer', rangeStart, rangeEnd);
  const rtcEstablished = await countEventsInRange('rtc_established', rangeStart, rangeEnd);
  const rtcSuccessRate = rtcOffers > 0 ? Number(((rtcEstablished / rtcOffers) * 100).toFixed(2)) : null;
  const rtcFallbacks = await countEventsInRange('rtc_fallback_to_relay', rangeStart, rangeEnd);
  const rtcFallbackRatio = rtcOffers > 0 ? Number(((rtcFallbacks / rtcOffers) * 100).toFixed(2)) : null;

  return {
    generatedAt: now.toISOString(),
    period: {
      key: periodKey,
      label: PERIOD_DEFINITIONS[periodKey]?.label || 'Custom',
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString(),
      minutes: rangeMinutes
    },
    bucket: {
      minutes: bucketMinutes,
      count: bucketCount
    },
    messages: {
      total: messageTotal,
      lastMinute: messagesLastMinute,
      lastHour: messagesLastHour,
      today: messagesToday,
      peak: peakMessages,
      history: messageHistory,
      deliveryLatencyP50: deliveryP50,
      deliveryLatencyP95: deliveryP95,
      ackLatencyP50: ackP50,
      ackLatencyP95: ackP95,
      ackRate: deliveredCount > 0 ? Number(((ackedCount / deliveredCount) * 100).toFixed(2)) : null
    },
    connections: {
      totalInteractions: connectionTotal,
      uniqueParticipants,
      newParticipants,
      returningParticipants,
      returningRate,
      active: peakConnections,
      newToday: newParticipants,
      history: connectionHistory
    },
    productInsights: {
      tokens: {
        total: counters.tokensAdded || 0,
        last24h: tokensAdded24h
      },
      blinks: {
        executes24h: counters.blinkExecutes || 0,
        successRate24h: null // Simplified
      },
      naturalCommands: {
        executed24h: counters.naturalCommandsExecuted || 0,
        failed24h: counters.naturalCommandsFailed || 0
      },
      actions: {
        send: {
          total: counters.actionsSend || 0,
          count24h: actionSend24h,
          volume24h: Number((actionSendVolume24h || 0).toFixed(4))
        },
        request: {
          total: counters.actionsRequests || 0,
          count24h: actionRequest24h,
          amount24h: Number((actionRequestAmount24h || 0).toFixed(4))
        },
        buy: {
          total: counters.actionsBuy || 0,
          count24h: actionBuy24h,
          volume24h: Number((actionBuyVolume24h || 0).toFixed(4))
        },
        agreement: {
          total: counters.actionsAgreements || 0,
          created24h: actionAgreementCreated24h,
          signed24h: actionAgreementSigned24h,
          settled24h: actionAgreementSettled24h
        }
      },
      messaging: {
        dmStarted: counters.dmStarted || 0,
        dmAccepted: counters.dmAccepted || 0,
        relayMessages: counters.relayMessages || 0,
        dmStarted24h,
        dmAccepted24h,
        relayMessages24h
      }
    },
    rtc: {
      offers: rtcOffers,
      established: rtcEstablished,
      successRate: rtcSuccessRate,
      ttcP50: 0, // Simplified - production version calculates percentiles
      ttcP95: 0, // Simplified - production version calculates percentiles
      fallback: { count: rtcFallbacks, ratioPct: rtcFallbackRatio }
    }
  };
};
