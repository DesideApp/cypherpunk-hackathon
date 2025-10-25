// Token Activation Service - Lazy loading for Dialect Markets tracking
// Only activate tokens when users actually interact with them

import logger from '#config/logger.js';

// In-memory cache of activated tokens (mint -> timestamp)
// In production, this should be a Redis cache or DB collection
const activatedTokens = new Map();

// How long to keep activation status cached (24 hours)
const ACTIVATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Check if a token is activated for tracking
 * @param {string} mint - Token mint address
 * @returns {boolean} True if token is activated and tracked
 */
export function isTokenActivated(mint) {
  if (!mint) return false;
  
  const activation = activatedTokens.get(mint);
  if (!activation) return false;

  // Check if activation is still valid (not expired)
  const now = Date.now();
  if (now - activation.timestamp > ACTIVATION_CACHE_TTL_MS) {
    // Expired, remove from cache
    activatedTokens.delete(mint);
    return false;
  }

  return true;
}

/**
 * Activate a token for tracking
 * This should be called when a user selects/interacts with a token
 * @param {string} mint - Token mint address
 * @param {string} code - Token code (e.g., 'BONK', 'SOL')
 * @param {string} triggeredBy - Who triggered the activation (user pubkey)
 * @returns {Object} Activation result
 */
export function activateToken(mint, code, triggeredBy = 'system') {
  if (!mint) {
    return { success: false, error: 'Mint address required' };
  }

  const now = Date.now();
  const wasActivated = isTokenActivated(mint);

  activatedTokens.set(mint, {
    mint,
    code,
    timestamp: now,
    triggeredBy,
    activationCount: wasActivated ? (activatedTokens.get(mint).activationCount + 1) : 1
  });

  logger.info('[tokenActivation] Token activated', {
    mint,
    code,
    triggeredBy,
    wasAlreadyActive: wasActivated
  });

  return {
    success: true,
    mint,
    code,
    wasAlreadyActive: wasActivated,
    activatedAt: new Date(now).toISOString()
  };
}

/**
 * Get list of all activated tokens
 * @returns {Array<Object>} List of activated tokens with metadata
 */
export function getActivatedTokens() {
  const now = Date.now();
  const active = [];

  for (const [mint, data] of activatedTokens.entries()) {
    // Only include non-expired activations
    if (now - data.timestamp <= ACTIVATION_CACHE_TTL_MS) {
      active.push({
        mint,
        code: data.code,
        activatedAt: new Date(data.timestamp).toISOString(),
        activationCount: data.activationCount,
        triggeredBy: data.triggeredBy
      });
    } else {
      // Clean up expired entries
      activatedTokens.delete(mint);
    }
  }

  return active;
}

/**
 * Get activation stats for monitoring
 * @returns {Object} Stats about token activations
 */
export function getActivationStats() {
  const active = getActivatedTokens();
  
  return {
    totalActive: active.length,
    cacheTTLHours: ACTIVATION_CACHE_TTL_MS / (60 * 60 * 1000),
    mostActivated: active.sort((a, b) => b.activationCount - a.activationCount).slice(0, 10),
    recentActivations: active.sort((a, b) => 
      new Date(b.activatedAt) - new Date(a.activatedAt)
    ).slice(0, 10)
  };
}

/**
 * Deactivate a token (for testing/admin purposes)
 * @param {string} mint - Token mint address
 * @returns {boolean} True if token was deactivated
 */
export function deactivateToken(mint) {
  const existed = activatedTokens.has(mint);
  if (existed) {
    activatedTokens.delete(mint);
    logger.info('[tokenActivation] Token deactivated', { mint });
  }
  return existed;
}

/**
 * Clear all activations (for testing/reset)
 */
export function clearAllActivations() {
  const count = activatedTokens.size;
  activatedTokens.clear();
  logger.warn('[tokenActivation] All activations cleared', { count });
  return { success: true, clearedCount: count };
}

