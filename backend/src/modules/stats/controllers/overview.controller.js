import { computeStatsOverview } from '../services/metrics.service.js';
import { readOverviewArchive } from '../services/archive.service.js';

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
      return res.status(200).json(archive);
    }

    const data = await computeStatsOverview({ bucketMinutes, bucketCount, period, rangeStart: from, rangeEnd: to });
    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Failed to compute stats overview:', error);
    return res.status(500).json({
      error: 'FAILED_TO_FETCH_STATS_OVERVIEW',
      nextStep: 'RETRY_LATER'
    });
  }
};
