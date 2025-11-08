// src/jobs/tasks/cleanupRelayByTier.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced cleanup logic, tier-based
// TTL management, and quota recalculation. Full implementation available
// in private repository.

import User from "#modules/users/models/user.model.js";
import logEvent from "#modules/stats/services/eventLogger.service.js";
import { getRelayStore } from '#modules/relay/services/relayStoreProvider.js';
import { createModuleLogger } from '#config/logger.js';

const log = createModuleLogger({ module: 'jobs.cleanupRelayByTier' });

let running = false;

/**
 * Limpia mensajes expirados por TTL del usuario.
 * Simplified implementation - production version has advanced tier-based logic.
 */
export async function cleanupRelayByTier(opts = {}) {
  if (running) {
    log.warn('cleanup_skip_running');
    return { skipped: true };
  }
  running = true;

  const dryRun = !!opts.dryRun;
  const started = Date.now();

  try {
    log.info('cleanup_start', { dryRun });

    const relayStore = getRelayStore();
    const cursor = User.find({}, { wallet: 1, relayTTLSeconds: 1 }).cursor();

    let removed = 0;
    let freedBytes = 0;

    for await (const user of cursor) {
      const wallet = user.wallet;
      const ttlSeconds = user.relayTTLSeconds || 7 * 24 * 60 * 60; // Default 7 days
      const cutoff = new Date(Date.now() - ttlSeconds * 1000);

      // Simplified cleanup - production version has advanced logic
      if (!dryRun) {
        const result = await relayStore.purgeExpired(wallet, cutoff);
        removed += result?.deletedCount || 0;
        freedBytes += result?.freedBytes || 0;
      }
    }

    const durationMs = Date.now() - started;
    log.info('cleanup_finish', { removed, freedBytes, durationMs });

    return {
      totals: { removed, freedBytes },
      durationMs,
    };
  } catch (error) {
    log.error('cleanup_error', { error: error?.message || error });
    throw error;
  } finally {
    running = false;
  }
}

export default cleanupRelayByTier;
