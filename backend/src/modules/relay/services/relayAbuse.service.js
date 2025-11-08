// src/modules/relay/services/relayAbuse.service.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced abuse detection,
// threshold management, and automatic blocking logic. Full implementation
// available in private repository.

import config from '#config/appConfig.js';
import logger from '#config/logger.js';
import {
  recordRelayAbuseFlag,
  setRelayAbuseBlocks,
} from '#modules/relay/services/relayMetrics.js';

const STORE = new Map();
const RELAY_ABUSE_CFG = config?.relayAbuse || {};
const ENABLED = RELAY_ABUSE_CFG.enabled !== false;
const ALLOWLIST = new Set(
  (Array.isArray(RELAY_ABUSE_CFG.allowlistWallets) ? RELAY_ABUSE_CFG.allowlistWallets : [])
    .map((wallet) => (typeof wallet === 'string' ? wallet.trim() : null))
    .filter(Boolean)
);

function buildKey(scope, id) {
  return `${scope}:${id}`;
}

function isAllowlisted(scope, id) {
  if (scope !== 'wallet') return false;
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
  if (!id || isAllowlisted(scope, id)) return null;

  const key = buildKey(scope, id);
  const entry = STORE.get(key);
  if (!entry?.block) return null;

  const now = Date.now();
  if (entry.block.until > now) {
    return {
      reason: entry.block.reason,
      retryAfterSeconds: Math.ceil((entry.block.until - now) / 1000),
    };
  }

  return null;
}

export function recordAbuseEvent({ scope = 'wallet', id, reason }) {
  if (!ENABLED) return null;
  if (!id || !reason || isAllowlisted(scope, id)) return { allowlisted: true };

  const threshold = RELAY_ABUSE_CFG.thresholds?.[reason];
  if (!threshold) return { tracked: false };

  const key = buildKey(scope, id);
  const now = Date.now();
  let entry = STORE.get(key) || { reasons: {}, block: null };

  // Simplified tracking - production version has advanced threshold logic
  const state = entry.reasons[reason] || { count: 0, firstSeen: now };
  state.count += 1;
  state.lastSeen = now;
  entry.reasons[reason] = state;

  // Simple blocking logic
  if (state.count >= (threshold.limit || 5)) {
    const blockSeconds = threshold.blockSeconds || 300;
    entry.block = {
      reason,
      until: now + blockSeconds * 1000,
    };
    logger.warn('[relay] abuse flag triggered', { scope, id, reason, count: state.count });
    recordRelayAbuseFlag(scope, reason);
  }

  STORE.set(key, entry);
  refreshBlockGauges();

  return {
    count: state.count,
    blocked: !!entry.block,
    blockUntil: entry.block?.until || null,
    reason,
    scope,
  };
}

export function unblockEntity({ scope = 'wallet', id }) {
  if (!id) return false;
  const key = buildKey(scope, id);
  if (!STORE.has(key)) return false;
  STORE.delete(key);
  logger.info('[relay] abuse manual unblock', { scope, id });
  refreshBlockGauges();
  return true;
}

export function getAbuseSnapshot() {
  const now = Date.now();
  const snapshot = [];
  for (const [key, entry] of STORE.entries()) {
    if (entry.block && entry.block.until <= now) continue;
    const [scope, id] = key.split(':');
    snapshot.push({
      scope,
      id,
      block: entry.block ? { reason: entry.block.reason, until: entry.block.until } : null,
      reasons: entry.reasons || {},
    });
  }
  return snapshot;
}

function refreshBlockGauges() {
  if (!ENABLED) return;
  const now = Date.now();
  let walletBlocks = 0;
  let ipBlocks = 0;

  for (const [key, entry] of STORE.entries()) {
    if (entry.block && entry.block.until > now) {
      const [scope] = key.split(':');
      if (scope === 'ip') ipBlocks += 1;
      else walletBlocks += 1;
    }
  }

  setRelayAbuseBlocks('wallet', walletBlocks);
  setRelayAbuseBlocks('ip', ipBlocks);
}
