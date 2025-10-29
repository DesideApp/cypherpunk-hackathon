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
const RELAY_FREE_QUOTA_MB = int(process.env.RELAY_FREE_QUOTA_MB, 30);
const RELAY_PLUS_QUOTA_MB = int(process.env.RELAY_PLUS_QUOTA_MB, 150);
const RELAY_PRO_QUOTA_MB  = int(process.env.RELAY_PRO_QUOTA_MB, 400);
const RELAY_FREE_VAULT_MB = int(process.env.RELAY_FREE_VAULT_MB, 500);
const RELAY_PLUS_VAULT_MB = int(process.env.RELAY_PLUS_VAULT_MB, 2048);
const RELAY_PRO_VAULT_MB  = int(process.env.RELAY_PRO_VAULT_MB, 5120);

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
  relayWarningRatio: Number.parseFloat(process.env.RELAY_WARNING_RATIO ?? '0.8'),
  relayCriticalRatio: Number.parseFloat(process.env.RELAY_CRITICAL_RATIO ?? '0.95'),

  // Límite JSON real que usará Express
  jsonBodyLimitBytes: JSON_BODY_LIMIT_BYTES,

  // Cron de limpieza de relay por tier (jobs/cleanupRelayByTier)
  relayCleanupCron: RELAY_CLEANUP_CRON,

  // Tiers por defecto (si el user no tiene override en Mongo)
  tiers: {
    free: {
      quotaBytes: mbToBytes(RELAY_FREE_QUOTA_MB),
      ttlSeconds: int(process.env.RELAY_FREE_TTL_SECONDS, 30 * 24 * 3600),
      perMessageMaxBytes: RELAY_MAX_BOX_BYTES,
      overflowGracePct: int(process.env.RELAY_FREE_GRACE_PCT, 0),
      vaultQuotaBytes: mbToBytes(RELAY_FREE_VAULT_MB),
      warningRatio: Number.parseFloat(process.env.RELAY_FREE_WARNING_RATIO ?? '0.8'),
      criticalRatio: Number.parseFloat(process.env.RELAY_FREE_CRITICAL_RATIO ?? '0.95'),
    },
    plus: {
      quotaBytes: mbToBytes(RELAY_PLUS_QUOTA_MB),
      ttlSeconds: int(process.env.RELAY_PLUS_TTL_SECONDS, 60 * 24 * 3600),
      perMessageMaxBytes: RELAY_MAX_BOX_BYTES,
      overflowGracePct: int(process.env.RELAY_PLUS_GRACE_PCT, 20),
      vaultQuotaBytes: mbToBytes(RELAY_PLUS_VAULT_MB),
      warningRatio: Number.parseFloat(process.env.RELAY_PLUS_WARNING_RATIO ?? '0.85'),
      criticalRatio: Number.parseFloat(process.env.RELAY_PLUS_CRITICAL_RATIO ?? '0.96'),
    },
    pro: {
      quotaBytes: mbToBytes(RELAY_PRO_QUOTA_MB),
      ttlSeconds: int(process.env.RELAY_PRO_TTL_SECONDS, 90 * 24 * 3600),
      perMessageMaxBytes: RELAY_MAX_BOX_BYTES,
      overflowGracePct: int(process.env.RELAY_PRO_GRACE_PCT, 25),
      vaultQuotaBytes: mbToBytes(RELAY_PRO_VAULT_MB),
      warningRatio: Number.parseFloat(process.env.RELAY_PRO_WARNING_RATIO ?? '0.88'),
      criticalRatio: Number.parseFloat(process.env.RELAY_PRO_CRITICAL_RATIO ?? '0.97'),
    },
  },

  orgTiers: {
    free: {
      quotaBytes: mbToBytes(int(process.env.RELAY_ORG_FREE_QUOTA_MB, RELAY_FREE_QUOTA_MB)),
      ttlSeconds: int(process.env.RELAY_ORG_FREE_TTL_SECONDS, 30 * 24 * 3600),
      perMessageMaxBytes: RELAY_MAX_BOX_BYTES,
      overflowGracePct: int(process.env.RELAY_ORG_FREE_GRACE_PCT, 0),
      vaultQuotaBytes: mbToBytes(int(process.env.RELAY_ORG_FREE_VAULT_MB, RELAY_FREE_VAULT_MB)),
      warningRatio: Number.parseFloat(process.env.RELAY_ORG_FREE_WARNING_RATIO ?? '0.8'),
      criticalRatio: Number.parseFloat(process.env.RELAY_ORG_FREE_CRITICAL_RATIO ?? '0.95'),
    },
    growth: {
      quotaBytes: mbToBytes(int(process.env.RELAY_ORG_GROWTH_QUOTA_MB, 300)),
      ttlSeconds: int(process.env.RELAY_ORG_GROWTH_TTL_SECONDS, 60 * 24 * 3600),
      perMessageMaxBytes: RELAY_MAX_BOX_BYTES,
      overflowGracePct: int(process.env.RELAY_ORG_GROWTH_GRACE_PCT, 20),
      vaultQuotaBytes: mbToBytes(int(process.env.RELAY_ORG_GROWTH_VAULT_MB, 5_000)),
      warningRatio: Number.parseFloat(process.env.RELAY_ORG_GROWTH_WARNING_RATIO ?? '0.85'),
      criticalRatio: Number.parseFloat(process.env.RELAY_ORG_GROWTH_CRITICAL_RATIO ?? '0.96'),
    },
    business: {
      quotaBytes: mbToBytes(int(process.env.RELAY_ORG_BUSINESS_QUOTA_MB, 800)),
      ttlSeconds: int(process.env.RELAY_ORG_BUSINESS_TTL_SECONDS, 90 * 24 * 3600),
      perMessageMaxBytes: RELAY_MAX_BOX_BYTES,
      overflowGracePct: int(process.env.RELAY_ORG_BUSINESS_GRACE_PCT, 25),
      vaultQuotaBytes: mbToBytes(int(process.env.RELAY_ORG_BUSINESS_VAULT_MB, 15_000)),
      warningRatio: Number.parseFloat(process.env.RELAY_ORG_BUSINESS_WARNING_RATIO ?? '0.88'),
      criticalRatio: Number.parseFloat(process.env.RELAY_ORG_BUSINESS_CRITICAL_RATIO ?? '0.97'),
    },
    enterprise: {
      quotaBytes: mbToBytes(int(process.env.RELAY_ORG_ENTERPRISE_QUOTA_MB, 1_500)),
      ttlSeconds: int(process.env.RELAY_ORG_ENTERPRISE_TTL_SECONDS, 180 * 24 * 3600),
      perMessageMaxBytes: RELAY_MAX_BOX_BYTES,
      overflowGracePct: int(process.env.RELAY_ORG_ENTERPRISE_GRACE_PCT, 30),
      vaultQuotaBytes: mbToBytes(int(process.env.RELAY_ORG_ENTERPRISE_VAULT_MB, 50_000)),
      warningRatio: Number.parseFloat(process.env.RELAY_ORG_ENTERPRISE_WARNING_RATIO ?? '0.9'),
      criticalRatio: Number.parseFloat(process.env.RELAY_ORG_ENTERPRISE_CRITICAL_RATIO ?? '0.98'),
    },
  },
});

export default config;
