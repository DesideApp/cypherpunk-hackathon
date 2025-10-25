// Token Activation Poller Job
// Keeps active tokens fresh by re-activating them periodically
// Prevents TTL expiration for frequently-used tokens

import logger from '#config/logger.js';
import { 
  getActivatedTokens, 
  activateToken,
  getActivationConfig 
} from '#modules/tokens/services/tokenActivationService.js';

let pollerInterval = null;

/**
 * Refresh all active tokens to prevent expiration
 * This ensures frequently-used tokens stay in cache
 */
function refreshActiveTokens() {
  try {
    const activeTokens = getActivatedTokens();
    
    if (activeTokens.length === 0) {
      logger.debug('[tokenPoller] No active tokens to refresh');
      return;
    }

    logger.info('[tokenPoller] Refreshing active tokens', {
      count: activeTokens.length,
      tokens: activeTokens.slice(0, 10).map(t => t.code) // Log first 10
    });

    // Re-activate each token to refresh TTL
    let refreshed = 0;
    for (const token of activeTokens) {
      activateToken(token.mint, token.code, 'system:poller');
      refreshed++;
    }

    logger.info('[tokenPoller] Tokens refreshed', {
      refreshedCount: refreshed,
      totalActive: activeTokens.length
    });
  } catch (error) {
    logger.error('[tokenPoller] Error refreshing tokens', {
      error: error.message
    });
  }
}

/**
 * Start the polling job
 */
export function startTokenActivationPoller() {
  const config = getActivationConfig();
  
  logger.info('[tokenPoller] Starting token activation poller', {
    intervalMinutes: config.pollingIntervalMinutes,
    cacheTTLHours: config.cacheTTLHours
  });

  // Run immediately on startup (after initial activation)
  setTimeout(() => refreshActiveTokens(), 10000); // 10s delay

  // Then run periodically
  pollerInterval = setInterval(
    refreshActiveTokens,
    config.pollingIntervalMs
  );

  logger.info('[tokenPoller] Poller started', {
    nextRun: new Date(Date.now() + config.pollingIntervalMs).toISOString()
  });
}

/**
 * Stop the polling job (for graceful shutdown)
 */
export function stopTokenActivationPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    logger.info('[tokenPoller] Poller stopped');
  }
}

/**
 * Get poller status
 * @returns {Object} Status information
 */
export function getPollerStatus() {
  const config = getActivationConfig();
  const activeTokens = getActivatedTokens();

  return {
    isRunning: !!pollerInterval,
    intervalMinutes: config.pollingIntervalMinutes,
    activeTokenCount: activeTokens.length,
    activeTokens: activeTokens.map(t => ({
      code: t.code,
      activationCount: t.activationCount,
      lastActivated: t.activatedAt
    }))
  };
}

