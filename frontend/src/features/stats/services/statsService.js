import { apiRequest } from "@shared/services/apiService.js";

function normalizeQuery(params = {}) {
  const out = { ...params };
  if (out.rangeStart && !out.from) {
    out.from = out.rangeStart;
    delete out.rangeStart;
  }
  if (out.rangeEnd && !out.to) {
    out.to = out.rangeEnd;
    delete out.rangeEnd;
  }
  return out;
}

export async function fetchStatsOverview(params) {
  const query = params && Object.keys(params).length
    ? `?${new URLSearchParams(normalizeQuery(params)).toString()}`
    : "";
  const data = await apiRequest(`/api/v1/stats/overview${query}`, { method: "GET" });

  if (!data || data.error) {
    const error = data?.message || "Unable to load stats overview.";
    throw new Error(error);
  }

  return data;
}
