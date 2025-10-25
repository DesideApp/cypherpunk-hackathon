import { computeStatsOverview } from '../services/metrics.service.js';

export const getStatsOverview = async (req, res) => {
  try {
    const { bucketMinutes, bucketCount, period } = req.query;
    // Soportar ambos nombres de parámetros: from/to y rangeStart/rangeEnd
    const from = req.query.from || req.query.rangeStart || undefined;
    const to = req.query.to || req.query.rangeEnd || undefined;

    const data = await computeStatsOverview({
      bucketMinutes,
      bucketCount,
      period,
      rangeStart: from,
      rangeEnd: to
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Failed to compute stats overview:', error);
    return res.status(500).json({
      error: 'FAILED_TO_FETCH_STATS_OVERVIEW',
      nextStep: 'RETRY_LATER'
    });
  }
};
