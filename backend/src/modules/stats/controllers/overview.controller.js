import { computeStatsOverview } from '../services/metrics.service.js';
import { readOverviewArchive } from '../services/archive.service.js';

function ensureOverviewShape(payload) {
  if (!payload || typeof payload !== 'object') return;
  payload.messages = payload.messages || {};
  Object.assign(payload.messages, {
    lastMinute: payload.messages.lastMinute ?? 0,
    lastHour: payload.messages.lastHour ?? 0,
    today: payload.messages.today ?? 0,
    total: payload.messages.total ?? 0,
    history: payload.messages.history ?? [],
    deliveryLatencyP50: payload.messages.deliveryLatencyP50 ?? null,
    deliveryLatencyP95: payload.messages.deliveryLatencyP95 ?? null,
    ackLatencyP50: payload.messages.ackLatencyP50 ?? null,
    ackLatencyP95: payload.messages.ackLatencyP95 ?? null,
    ackRate: payload.messages.ackRate ?? null,
    peak: payload.messages.peak ?? 0,
    p95: payload.messages.p95 ?? null,
    avgPerBucket: payload.messages.avgPerBucket ?? 0,
  });

  payload.connections = payload.connections || {};
  Object.assign(payload.connections, {
    active: payload.connections.active ?? 0,
    activeLastHour: payload.connections.activeLastHour ?? 0,
    newToday: payload.connections.newToday ?? 0,
    disconnections: payload.connections.disconnections ?? 0,
    peak24h: payload.connections.peak24h ?? 0,
    avgActive: payload.connections.avgActive ?? 0,
    peak: payload.connections.peak ?? 0,
    p95: payload.connections.p95 ?? null,
    avgPerBucket: payload.connections.avgPerBucket ?? 0,
    uniqueParticipants: payload.connections.uniqueParticipants ?? 0,
    newParticipants: payload.connections.newParticipants ?? 0,
    returningParticipants: payload.connections.returningParticipants ?? 0,
    returningRate: payload.connections.returningRate ?? null,
    totalInteractions: payload.connections.totalInteractions ?? 0,
    dau: payload.connections.dau ?? 0,
    history: payload.connections.history ?? [],
  });

  payload.rtc = payload.rtc || {};
  payload.rtc.fallback = payload.rtc.fallback || {};
  Object.assign(payload.rtc, {
    offers: payload.rtc.offers ?? 0,
    established: payload.rtc.established ?? 0,
    successRate: payload.rtc.successRate ?? null,
    ttcP50: payload.rtc.ttcP50 ?? null,
    ttcP95: payload.rtc.ttcP95 ?? null,
  });
  payload.rtc.fallback = {
    count: payload.rtc.fallback.count ?? 0,
    ratioPct: payload.rtc.fallback.ratioPct ?? null,
  };

  payload.productInsights = payload.productInsights || { actions: {}, messaging: {} };
  payload.productInsights.actions = payload.productInsights.actions || {};
  const defaultAction = { total: 0, count24h: 0, volume24h: 0, amount24h: 0 };
  payload.productInsights.actions.send = Object.assign({}, defaultAction, payload.productInsights.actions.send);
  payload.productInsights.actions.request = Object.assign({}, defaultAction, payload.productInsights.actions.request);
  payload.productInsights.actions.buy = Object.assign({}, defaultAction, payload.productInsights.actions.buy);
  payload.productInsights.actions.agreement = Object.assign({}, {
    total: 0,
    created24h: 0,
    signed24h: 0,
    settled24h: 0,
  }, payload.productInsights.actions.agreement);
  payload.productInsights.messaging = Object.assign({
    dmStarted: 0,
    dmAccepted: 0,
    relayMessages: 0,
    dmStarted24h: 0,
    dmAccepted24h: 0,
    relayMessages24h: 0,
  }, payload.productInsights.messaging);
}

export const getStatsOverview = async (req, res) => {
  try {
    const { bucketMinutes, bucketCount, period } = req.query;
    // Soportar ambos nombres de parámetros: from/to y rangeStart/rangeEnd
    const from = req.query.from || req.query.rangeStart || undefined;
    const to = req.query.to || req.query.rangeEnd || undefined;

    // If requested range exceeds HOT_RETENTION_DAYS (default 7), use archive snapshots
    const hotDays = Math.max(1, parseInt(process.env.HOT_RETENTION_DAYS || '7', 10));
    const now = new Date();
    const hotThreshold = new Date(now.getTime() - hotDays * 24 * 60 * 60 * 1000);
    const rangeStart = from ? new Date(from) : null;
    const rangeEnd = to ? new Date(to) : null;

    if (rangeStart && rangeStart < hotThreshold) {
      const start = new Date(rangeStart);
      const end = rangeEnd && rangeEnd < now ? new Date(rangeEnd) : now;
      const archive = await readOverviewArchive(start, end);
      ensureOverviewShape(archive);
      return res.status(200).json(archive);
    }

    const data = await computeStatsOverview({ bucketMinutes, bucketCount, period, rangeStart: from, rangeEnd: to });
    ensureOverviewShape(data);
    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Failed to compute stats overview:', error);
    return res.status(500).json({
      error: 'FAILED_TO_FETCH_STATS_OVERVIEW',
      nextStep: 'RETRY_LATER'
    });
  }
};
