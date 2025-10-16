// src/features/messaging/utils/rtcTelemetry.js
// Observabilidad simple: ratio RTC vs Relay por conversación

const stats = new Map(); // convId -> { rtc: count, relay: count, lastReset: timestamp }
const RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24h

export function trackMessageSent(convId, via) {
  if (!convId || !via) return;
  
  const now = Date.now();
  let stat = stats.get(convId);
  
  if (!stat || (now - stat.lastReset) > RESET_INTERVAL) {
    stat = { rtc: 0, relay: 0, lastReset: now };
    stats.set(convId, stat);
  }
  
  if (via === 'rtc' || via === 'rtc-fallback') {
    stat.rtc++;
  } else if (via === 'relay') {
    stat.relay++;
  }
  
  // Log cada 10 mensajes para ver el ratio
  const total = stat.rtc + stat.relay;
  if (total > 0 && total % 10 === 0) {
    const rtcPercent = Math.round((stat.rtc / total) * 100);
    console.debug(`[rtc-telemetry] ${convId.slice(-8)}: ${rtcPercent}% RTC (${stat.rtc}/${total})`);
  }
}

export function getRtcStats(convId) {
  const stat = stats.get(convId);
  if (!stat) return { rtc: 0, relay: 0, total: 0, rtcPercent: 0 };
  
  const total = stat.rtc + stat.relay;
  const rtcPercent = total > 0 ? Math.round((stat.rtc / total) * 100) : 0;
  
  return {
    rtc: stat.rtc,
    relay: stat.relay,
    total,
    rtcPercent,
    lastReset: stat.lastReset,
  };
}

export function getAllStats() {
  const result = {};
  for (const [convId] of stats.entries()) {
    result[convId] = getRtcStats(convId);
  }
  return result;
}
