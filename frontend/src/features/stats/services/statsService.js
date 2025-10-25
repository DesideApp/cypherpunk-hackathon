import { apiRequest } from "@shared/services/apiService.js";

function normalizeQuery(params = {}) {
  const out = {};
  if (params.period) out.period = params.period;
  if (params.bucketMinutes) out.bucketMinutes = params.bucketMinutes;
  if (params.bucketCount) out.bucketCount = params.bucketCount;
  const from = params.from ?? params.rangeStart;
  const to = params.to ?? params.rangeEnd;
  if (from) out.from = typeof from === 'string' ? from : new Date(from).toISOString();
  if (to) out.to = typeof to === 'string' ? to : new Date(to).toISOString();
  return out;
}

export async function fetchStatsOverview(params = {}) {
  const queryString = (() => {
    const q = normalizeQuery(params);
    const qs = new URLSearchParams(q).toString();
    return qs ? `?${qs}` : '';
  })();

  const data = await apiRequest(`/api/v1/stats/overview${queryString}`, { method: "GET" });
  if (!data || data.error) {
    const error = data?.message || "Unable to load stats overview.";
    throw new Error(error);
  }
  return data;
}
