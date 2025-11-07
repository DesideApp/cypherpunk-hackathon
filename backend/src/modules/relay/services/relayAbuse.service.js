import config from '#config/appConfig.js';
import logger from '#config/logger.js';
import {
  recordRelayAbuseFlag,
  setRelayAbuseBlocks,
} from '#modules/relay/services/relayMetrics.js';

const STORE = new Map();

const RELAY_ABUSE_CFG = config?.relayAbuse || {};
const TTL_MS = Math.max(30, Number(RELAY_ABUSE_CFG.ttlSeconds || 900)) * 1000;
const ENABLED = RELAY_ABUSE_CFG.enabled !== false;
const ALLOWLIST = new Set(
  (Array.isArray(RELAY_ABUSE_CFG.allowlistWallets) ? RELAY_ABUSE_CFG.allowlistWallets : [])
    .map((wallet) => (typeof wallet === 'string' ? wallet.trim() : null))
    .filter(Boolean)
);
const IP_MULTIPLIER = Number.isFinite(RELAY_ABUSE_CFG.ipThresholdMultiplier)
  ? Math.max(1, RELAY_ABUSE_CFG.ipThresholdMultiplier)
  : 4;

function buildKey(scope, id) {
  return `${scope}:${id}`;
}

function pruneEntry(key, entry, now) {
  if (!entry) return;

  if (entry.block && entry.block.until <= now) {
    entry.block = null;
  }

  if (entry.reasons) {
    for (const reason of Object.keys(entry.reasons)) {
      const state = entry.reasons[reason];
      if (!state || state.expiresAt <= now) {
        delete entry.reasons[reason];
      }
    }
  }

  if ((!entry.reasons || Object.keys(entry.reasons).length === 0) && (!entry.block || entry.block.until <= now)) {
    STORE.delete(key);
  }
}

function resolveThreshold(reason, scope) {
  if (!reason) return null;
  const cfg = RELAY_ABUSE_CFG.thresholds?.[reason];
  if (!cfg) return null;

  const limit = Math.max(
    0,
    scope === 'ip' ? Math.ceil((cfg.limit || 0) * IP_MULTIPLIER) : cfg.limit || 0
  );
  const blockSeconds = Math.max(0, cfg.blockSeconds || 0);

  if (!limit || !blockSeconds) {
    return null;
  }

  return { limit, blockSeconds };
}

function isAllowlisted(scope, id) {
  if (scope !== 'wallet') return false;
  if (!id) return false;
  return ALLOWLIST.has(id);
}

export function resetAbuseState() {
  STORE.clear();
  if (ENABLED) {
    setRelayAbuseBlocks('wallet', 0);
    setRelayAbuseBlocks('ip', 0);
  }
}

export function shouldBlock({ scope = 'wallet', id }) {
  if (!ENABLED) return null;
  if (!id) return null;
  if (isAllowlisted(scope, id)) return null;

  const key = buildKey(scope, id);
  const entry = STORE.get(key);
  if (!entry) return null;

  const now = Date.now();
  pruneEntry(key, entry, now);
  if (!STORE.has(key)) return null;

  if (entry.block && entry.block.until > now) {
    return {
      reason: entry.block.reason,
      retryAfterSeconds: Math.ceil((entry.block.until - now) / 1000),
    };
  }

  return null;
}

export function recordAbuseEvent({ scope = 'wallet', id, reason }) {
  if (!ENABLED) return null;
  if (!id || !reason) return null;
  if (isAllowlisted(scope, id)) return { allowlisted: true };

  const threshold = resolveThreshold(reason, scope);
  if (!threshold) {
    return { tracked: false };
  }

  const key = buildKey(scope, id);
  const now = Date.now();
  let entry = STORE.get(key);
  if (!entry) {
    entry = { reasons: Object.create(null), block: null };
    STORE.set(key, entry);
  }

  pruneEntry(key, entry, now);
  if (!STORE.has(key)) {
    entry = { reasons: Object.create(null), block: null };
    STORE.set(key, entry);
  }

  const reasons = entry.reasons || (entry.reasons = Object.create(null));
  let state = reasons[reason];
  if (!state || state.expiresAt <= now) {
    state = {
      count: 0,
      firstSeen: now,
    };
  }

  state.count += 1;
  state.lastSeen = now;
  state.expiresAt = now + TTL_MS;
  reasons[reason] = state;

  let blocked = false;
  let blockUntil = entry.block?.until || null;
  let triggeredNow = false;

  if (!entry.block || entry.block.until <= now) {
    if (state.count >= threshold.limit) {
      const until = now + threshold.blockSeconds * 1000;
      entry.block = {
        reason,
        until,
      };
      blocked = true;
      blockUntil = until;
      triggeredNow = true;

      logger.warn('[relay] abuse flag triggered', {
        scope,
        id,
        reason,
        count: state.count,
        blockSeconds: threshold.blockSeconds,
      });
    }
  } else if (entry.block.until > now) {
    blocked = true;
    blockUntil = entry.block.until;
  }

  STORE.set(key, entry);
  if (triggeredNow) {
    recordRelayAbuseFlag(scope, reason);
  }
  refreshBlockGauges();

  return {
    count: state.count,
    blocked,
    blockUntil,
    reason,
    scope,
  };
}

export function unblockEntity({ scope = 'wallet', id }) {
  if (!id) return false;
  const key = buildKey(scope, id);
  const entry = STORE.get(key);
  if (!entry) return false;
  STORE.delete(key);
  logger.info('[relay] abuse manual unblock', { scope, id });
  refreshBlockGauges();
  return true;
}

export function getAbuseSnapshot() {
  const now = Date.now();
  const snapshot = [];
  for (const key of Array.from(STORE.keys())) {
    const entry = STORE.get(key);
    pruneEntry(key, entry, now);
    if (!STORE.has(key)) continue;
    const [scope, id] = key.split(':');
    snapshot.push({
      scope,
      id,
      block: entry.block
        ? {
            reason: entry.block.reason,
            until: entry.block.until,
          }
        : null,
      reasons: Object.fromEntries(
        Object.entries(entry.reasons || {}).map(([reason, state]) => [
          reason,
          {
            count: state.count,
            expiresAt: state.expiresAt,
            firstSeen: state.firstSeen,
            lastSeen: state.lastSeen,
          },
        ])
      ),
    });
  }
  return snapshot;
}

function refreshBlockGauges() {
  if (!ENABLED) return;
  const now = Date.now();
  let walletBlocks = 0;
  let ipBlocks = 0;

  for (const key of Array.from(STORE.keys())) {
    const entry = STORE.get(key);
    pruneEntry(key, entry, now);
    if (!STORE.has(key)) continue;
    if (entry.block && entry.block.until > now) {
      const [scope] = key.split(':');
      if (scope === 'ip') ipBlocks += 1;
      else walletBlocks += 1;
    }
  }

  setRelayAbuseBlocks('wallet', walletBlocks);
  setRelayAbuseBlocks('ip', ipBlocks);
}
