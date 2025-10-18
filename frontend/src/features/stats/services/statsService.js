import { apiRequest } from "@shared/services/apiService.js";

export async function fetchStatsOverview() {
  const data = await apiRequest("/api/v1/stats/overview", { method: "GET" });

  if (!data || data.error) {
    const error = data?.message || "Unable to load stats overview.";
    throw new Error(error);
  }

  return data;
}
