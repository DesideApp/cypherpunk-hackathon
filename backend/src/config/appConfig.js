// s#config/appConfig.js
import dotenv from 'dotenv';
dotenv.config();

const bool = (v, def = false) => (v == null ? def : String(v).toLowerCase() === 'true');
const int  = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};
const mbToBytes = (mb) => Math.max(1, Math.floor(Number(mb) || 0)) * 1024 * 1024;

const RELAY_MAX_BOX_BYTES = int(process.env.RELAY_MAX_BOX_BYTES, 3_000_000);

// Si JSON_BODY_LIMIT_MB está presente, respétalo; si no, por defecto:
//   max( RELAY_MAX_BOX_BYTES + 1MB de margen , 5MB mínimo )
const JSON_BODY_LIMIT_BYTES = (() => {
  const fromEnvMb = process.env.JSON_BODY_LIMIT_MB;
  if (fromEnvMb != null && fromEnvMb !== '') {
    return mbToBytes(fromEnvMb);
  }
  return Math.max(RELAY_MAX_BOX_BYTES + 1_000_000, 5_000_000);
})();

// Cron de limpieza configurable. Prod recomendado: '5 3 * * *' (03:05 cada día)
// En tu Render tienes '*/30 * * * *' (cada 30 min)
const RELAY_CLEANUP_CRON = (process.env.RELAY_CLEANUP_CRON || '5 3 * * *').trim();

const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS / Web
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean),

  // Auth
  allowBearerAuth: bool(process.env.ALLOW_BEARER_AUTH, false),
  bearerRouteWhitelist: (process.env.BEARER_ROUTE_WHITELIST || '^/api/relay/,^/api/signal/')
    .split(',').map(s => s.trim()).filter(Boolean),

  // Relay (cap global por mensaje como red de seguridad; base64 BYTES)
  // Default 3 MB si no hay env.
  relayMaxBoxBytes: RELAY_MAX_BOX_BYTES,
  relayGlobalTtlSeconds: int(process.env.RELAY_TTL_SECONDS, 30 * 24 * 3600),
  relayOfflineOnly: bool(process.env.RELAY_OFFLINE_ONLY, true),
  relayEnabled: bool(process.env.ENABLE_RELAY, true),

  // Límite JSON real que usará Express
  jsonBodyLimitBytes: JSON_BODY_LIMIT_BYTES,

  // Cron de limpieza de relay por tier (jobs/cleanupRelayByTier)
  relayCleanupCron: RELAY_CLEANUP_CRON,

  // Tiers por defecto (si el user no tiene override en Mongo)
  tiers: {
    basic: {
      quotaBytes: 8 * 1024 * 1024,        // 8 MB pool
      ttlSeconds: 5 * 24 * 3600,          // 5 días
      perMessageMaxBytes: 3_000_000,      // 3 MB por mensaje
    },
  },
});

export default config;
