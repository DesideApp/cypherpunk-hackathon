import { apiRequest } from "@shared/services/apiService.js";

/**
 * Fetch stats overview from backend, honoring optional period/range/bucket params.
 * UI builds params via buildPeriodRequest(periodKey) → { period, bucketMinutes, rangeStart, rangeEnd }.
 * Backend expects: period, bucketMinutes, bucketCount, from, to.
 */
export async function fetchStatsOverview(params = {}) {
  // Map UI params to backend querystring
  const mapped = {};
  if (params.period) mapped.period = params.period;
  if (params.bucketMinutes) mapped.bucketMinutes = params.bucketMinutes;
  if (params.bucketCount) mapped.bucketCount = params.bucketCount;

  const from = params.rangeStart ?? params.from;
  const to = params.rangeEnd ?? params.to;
  if (from) mapped.from = typeof from === 'string' ? from : new Date(from).toISOString();
  if (to) mapped.to = typeof to === 'string' ? to : new Date(to).toISOString();

  const qs = new URLSearchParams(mapped).toString();
  const url = `/api/v1/stats/overview${qs ? `?${qs}` : ''}`;

  const data = await apiRequest(url, { method: "GET" });
  if (!data || data.error) {
    const error = data?.message || "Unable to load stats overview.";
    throw new Error(error);
  }
  return data;
}
