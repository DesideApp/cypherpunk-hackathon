import { ENDPOINTS, RTC_CONFIG } from "@shared/config/env.js";
import { authedFetchJson as fetchJson } from "@features/messaging/clients/fetcher.js";
import { setFeature } from "@shared/config/featureFlags.js";
import { createDebugLogger } from "@shared/utils/debug.js";

const DEBUG = createDebugLogger("ice", { envKey: "VITE_DEBUG_RTC_LOGS" });

/**
 * Obtiene servidores ICE con fallback a STUN.
 * 403 → deshabilita flag WEBRTC local; 503 → marca caída temporal.
 */
export async function getIceServersSafe() {
  try {
    const res = await fetchJson(ENDPOINTS?.RTC_ICE || "/api/v1/rtc/ice", { method: "GET" });
    const list = res?.iceServers || res;
    if (Array.isArray(list) && list.length) {
      DEBUG('fetched', { count: list.length });
      const score = (u) => {
        try {
          const url = typeof u === 'string' ? u : (u?.urls || '');
          const s = String(url);
          const isTurns443   = /^turns:\/\/.+?:443(\?|$)/i.test(s) || /turns:.*transport=tcp/i.test(s);
          const isTurnTcp443 = /^turn:\/\/.+?:443(\?|$)/i.test(s) && /transport=tcp/i.test(s);
          const isTurn       = /^turns?:/i.test(s);
          const isStun       = /^stuns?:/i.test(s);
          if (isTurns443) return 0;
          if (isTurnTcp443) return 1;
          if (isTurn) return 2;
          if (isStun) return 3;
          return 4;
        } catch { return 5; }
      };
      return list.slice().sort((a, b) => score(a) - score(b));
    }
    return RTC_CONFIG.iceServers;
  } catch (e) {
    const status = e?.details?.statusCode || e?.status;
    if (status === 403) {
      DEBUG('feature disabled remotely, using STUN fallback');
      setFeature('WEBRTC', false);
      return RTC_CONFIG.iceServers;
    }
    if (status === 503) {
      DEBUG('temporarily unavailable, using STUN fallback');
      setFeature('RTC_TEMP_DOWN', true);
      return RTC_CONFIG.iceServers;
    }
    DEBUG('fetch failed, using STUN fallback', e?.message);
    return RTC_CONFIG.iceServers;
  }
}
