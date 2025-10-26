import mongoose from 'mongoose';
import logger from '#config/logger.js';

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
  if (from > to) { const tmp = from; from = to; to = tmp; }
  return { from, to };
}

function clampBucketMinutes(value, fallback) {
  const n = parseInt(value ?? '', 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(24 * 60, Math.max(1, n));
}

async function computeApproxPercentile(coll, match, percentile = 95, buckets = 50) {
  const cur = await coll.aggregate([
    { $match: match },
    { $bucketAuto: { groupBy: '$durationMs', buckets } },
    { $project: { _id: 0, min: '$_id.min', max: '$_id.max', count: 1 } },
  ]).toArray();
  if (!cur.length) return 0;
  const total = cur.reduce((s, b) => s + (b.count || 0), 0);
  if (total === 0) return 0;
  let acc = 0;
  const target = Math.ceil((percentile / 100) * total);
  for (const b of cur) {
    acc += b.count || 0;
    if (acc >= target) return Math.round(b.max || 0);
  }
  return Math.round(cur[cur.length - 1].max || 0);
}

export async function getInfraOverview(req, res) {
  try {
    const { from, to } = resolveRange(req.query);
    const bucketMinutes = clampBucketMinutes(req.query.bucketMinutes, 5);

    const defaultOverview = (extra = {}) => ({
      range: { from: from.toISOString(), to: to.toISOString() },
      bucket: { minutes: bucketMinutes },
      totals: {
        requests: 0,
        errors: 0,
        errorRate: 0,
        avgLatency: 0,
        maxLatency: 0,
        p95: 0,
        p99: 0,
      },
      topRoutes: [],
      series: [],
      ...extra,
    });

    const db = mongoose.connection?.db;
    if (!db) {
      return res.status(200).json(defaultOverview());
    }
    const http = db.collection('apm_http');

    const match = { ts: { $gte: from, $lte: to } };

    const [totals] = await http.aggregate([
      { $match: match },
      { $group: {
          _id: null,
          count: { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ['$status', 400] }, 1, 0] } },
          avgLatency: { $avg: '$durationMs' },
          maxLatency: { $max: '$durationMs' }
        }
      }
    ]).toArray().catch(() => [null]);

    const overallP95 = await computeApproxPercentile(http, match, 95, 60).catch(() => 0);
    const overallP99 = await computeApproxPercentile(http, match, 99, 100).catch(() => 0);

    const topRoutes = await http.aggregate([
      { $match: match },
      { $group: {
          _id: '$route',
          count: { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ['$status', 400] }, 1, 0] } },
          avgLatency: { $avg: '$durationMs' },
          maxLatency: { $max: '$durationMs' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray().catch(() => []);

    for (const r of topRoutes) {
      try {
        const routeMatch = { ...match, route: r._id };
        r.p95 = await computeApproxPercentile(http, routeMatch, 95, 50).catch(() => 0);
        r.p99 = await computeApproxPercentile(http, routeMatch, 99, 80).catch(() => 0);
      } catch {}
    }

    const bucketMs = bucketMinutes * 60 * 1000;
    const startAligned = new Date(Math.floor(from.getTime() / bucketMs) * bucketMs);
    const seriesAgg = await http.aggregate([
      { $match: match },
      { $group: {
          _id: { $dateTrunc: { date: '$ts', unit: 'minute', binSize: bucketMinutes } },
          count: { $sum: 1 },
          errors: { $sum: { $cond: [{ $gte: ['$status', 400] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray().catch(() => []);

    const map = new Map();
    for (const b of seriesAgg) map.set(new Date(b._id).getTime(), b);

    const outSeries = [];
    for (let t = startAligned.getTime(); t <= to.getTime(); t += bucketMs) {
      const row = map.get(t) || { count: 0, errors: 0 };
      const errorRate = row.count > 0 ? Number(((row.errors / row.count) * 100).toFixed(2)) : 0;
      outSeries.push({ timestamp: new Date(t), count: row.count || 0, errorRate });
    }

    const overview = {
      range: { from: from.toISOString(), to: to.toISOString() },
      bucket: { minutes: bucketMinutes },
      totals: {
        requests: totals?.count || 0,
        errors: totals?.errors || 0,
        errorRate: totals?.count ? Number(((totals.errors / totals.count) * 100).toFixed(2)) : 0,
        avgLatency: Math.round(totals?.avgLatency || 0),
        maxLatency: Math.round(totals?.maxLatency || 0),
        p95: overallP95 || 0,
        p99: overallP99 || 0,
      },
      topRoutes: (topRoutes || []).map(r => ({
        route: r._id,
        count: r.count || 0,
        errors: r.errors || 0,
        errorRate: (r.count || 0) ? Number((((r.errors || 0) / r.count) * 100).toFixed(2)) : 0,
        avgLatency: Math.round(r.avgLatency || 0),
        maxLatency: Math.round(r.maxLatency || 0),
        p95: r.p95 || 0,
        p99: r.p99 || 0,
      })),
      series: outSeries,
    };

    const DBG = String(process.env.STATS_DEBUG || 'false').toLowerCase() === 'true';
    if (DBG) logger.info(`[infra] totals=${overview.totals.requests} p95=${overview.totals.p95} buckets=${overview.series.length}`);
    return res.status(200).json(overview);
  } catch (error) {
    // Fallback completamente tolerante
    const { from, to } = resolveRange(req.query || {});
    const bucketMinutes = clampBucketMinutes(req.query?.bucketMinutes, 5);
    return res.status(200).json({
      range: { from: from.toISOString(), to: to.toISOString() },
      bucket: { minutes: bucketMinutes },
      totals: { requests: 0, errors: 0, errorRate: 0, avgLatency: 0, maxLatency: 0, p95: 0, p99: 0 },
      topRoutes: [],
      series: [],
    });
  }
}

export default { getInfraOverview };
