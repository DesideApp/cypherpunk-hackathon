import rateLimit from 'express-rate-limit';
import logger from '#config/logger.js';
import config from '#config/appConfig.js';
import { recordRelayRateLimit } from '#modules/relay/services/relayMetrics.js';
import { recordAbuseEvent } from '#modules/relay/services/relayAbuse.service.js';

const int = (v, def) => {
  const parsed = parseInt(v, 10);
  return Number.isFinite(parsed) ? parsed : def;
};

const rateLimits = config?.relayRateLimits || {};
const enqueueCfg = rateLimits.enqueue || {};
const fetchCfg = rateLimits.fetch || {};
const historyRtcCfg = rateLimits.historyRtc || {};

function keyFromIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
}

function keyFromWallet(req) {
  return req.user?.wallet || keyFromIp(req);
}

function buildLimiter({ windowMs, max, scope, route }) {
  if (!Number.isFinite(max) || max <= 0) {
    // Limiter deshabilitado: pasa directamente
    return function passThrough(req, res, next) {
      next();
    };
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: scope === 'wallet' ? keyFromWallet : keyFromIp,
    handler: (req, res /*, next*/) => {
      recordRelayRateLimit(route, scope);
      const wallet = req.user?.wallet || null;
      const ip = keyFromIp(req);
      if (wallet) {
        recordAbuseEvent({ scope: 'wallet', id: wallet, reason: 'rate_limited' });
      }
      if (ip) {
        recordAbuseEvent({ scope: 'ip', id: ip, reason: 'rate_limited' });
      }
      logger.warn('[relay] rate limit hit', {
        route,
        scope,
        wallet,
        ip,
      });
      const retryAfter = Math.ceil(windowMs / 1000);
      if (retryAfter > 0) res.set('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'rate_limited', detail: scope });
    },
  });
}

const ONE_MINUTE = 60 * 1000;

export const relayEnqueueWalletLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: enqueueCfg.walletPerMinute ?? 30,
  scope: 'wallet',
  route: 'enqueue',
});

export const relayEnqueueIpLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: enqueueCfg.ipPerMinute ?? 60,
  scope: 'ip',
  route: 'enqueue',
});

export const relayHistoryRtcWalletLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: historyRtcCfg.walletPerMinute ?? 60,
  scope: 'wallet',
  route: 'history_rtc',
});

export const relayHistoryRtcIpLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: historyRtcCfg.ipPerMinute ?? 120,
  scope: 'ip',
  route: 'history_rtc',
});

export const relayFetchWalletLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: fetchCfg.walletPerMinute ?? 120,
  scope: 'wallet',
  route: 'fetch',
});

export const relayFetchIpLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: fetchCfg.ipPerMinute ?? 240,
  scope: 'ip',
  route: 'fetch',
});

export const relayAttachmentWalletLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: int(process.env.RELAY_RATE_LIMIT_ATTACHMENTS_WALLET_PER_MIN, 60),
  scope: 'wallet',
  route: 'attachments_presign',
});

export const relayAttachmentIpLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: int(process.env.RELAY_RATE_LIMIT_ATTACHMENTS_IP_PER_MIN, 120),
  scope: 'ip',
  route: 'attachments_presign',
});
