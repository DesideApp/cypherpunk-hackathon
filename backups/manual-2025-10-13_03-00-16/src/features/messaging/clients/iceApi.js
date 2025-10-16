// src/features/messaging/clients/iceApi.js
import { authedFetchJson as fetchWithAuth } from "@features/messaging/clients/fetcher.js";
import { ENDPOINTS } from "@shared/config/env.js";

/**
 * GET /api/rtc/ice → { iceServers:[...], ttl, serverTime? }
 * Devuelve { iceServers, ttl, serverTime }
 */
export async function fetchIceServers() {
  const r = await fetchWithAuth(ENDPOINTS.RTC_ICE, { method: "GET", sensitive: true });
  const iceServers = Array.isArray(r?.iceServers) ? r.iceServers : (r?.data?.iceServers || []);
  const ttl = Number(r?.ttl || 0);
  const serverTime = Number(r?.serverTime || 0);
  return { iceServers, ttl, serverTime };
}
