// src/features/messaging/clients/iceCache.js
// Pequeño caché en memoria para credenciales ICE (Twilio) con TTL.
// - Usa /api/rtc/ice vía fetcher (cookies+CSRF)
// - Tolera 403 (feature gate off) y 503; en esos casos se retorna null

import ENV from "@shared/config/env.js";
import { fetchIceServers } from "./iceApi.js";

let cache = {
  iceServers: null,
  // Epoch en ms (con margen de 30s)
  expiresAtMs: 0,
};

function nowMs() { return Date.now(); }

/**
 * Obtiene RTC config preferido: credenciales Twilio si están habilitadas;
 * si no, fallback a ENV.RTC_CONFIG (stun público).
 */
export async function getRtcConfigPreferIce() {
  try {
    // Si el caché es válido por >10s, úsalo
    if (cache.iceServers && cache.expiresAtMs - nowMs() > 10_000) {
      return { iceServers: cache.iceServers };
    }

    // Intenta obtener ICE desde backend (feature-gated)
    const res = await fetchIceServers(); // { iceServers, ttl, serverTime? }
    const iceServers = Array.isArray(res?.iceServers) ? res.iceServers : null;
    const ttlSec = Number(res?.ttl || 0);
    const baseMs = nowMs();
    const expiryMs = baseMs + Math.max(0, ttlSec - 30) * 1000; // margen 30s

    if (iceServers && iceServers.length) {
      cache.iceServers = iceServers;
      cache.expiresAtMs = expiryMs || (baseMs + 60_000);
      return { iceServers };
    }
  } catch (_error) {
    // 403/503 u otros: feature no disponible o problema upstream → fallback
  }

  // Fallback: STUN por defecto
  return { iceServers: ENV?.RTC_CONFIG?.iceServers || [{ urls: "stun:stun.l.google.com:19302" }] };
}

export default { getRtcConfigPreferIce };
