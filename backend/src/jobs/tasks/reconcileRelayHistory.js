// src/jobs/tasks/reconcileRelayHistory.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced reconciliation logic,
// batch processing, and drift detection. Full implementation available
// in private repository.

import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import ConversationMessage from '#modules/history/models/message.model.js';
import { appendMessageToHistory } from '#modules/history/services/history.service.js';
import { createModuleLogger } from '#config/logger.js';

const log = createModuleLogger({ module: 'jobs.reconcileRelayHistory' });

const DEFAULT_BATCH_SIZE = Number.parseInt(process.env.RECONCILE_BATCH_SIZE ?? '500', 10);

/**
 * Reconciliación relay ↔ history.
 * Simplified implementation - production version has advanced batch processing.
 */
export async function reconcileRelayHistory({
  batchSize = DEFAULT_BATCH_SIZE,
  repair = true,
  checkHistory = true,
} = {}) {
  const started = Date.now();
  const stats = {
    checked: 0,
    missingInHistory: 0,
    repaired: 0,
    repairFailed: 0,
    missingInRelay: 0,
  };

  log.info('reconcile_start', { batchSize, repair, checkHistory });

  try {
    // Simplified reconciliation - production version has advanced logic
    const cursor = RelayMessage.find({}, null, { lean: true }).limit(batchSize).cursor();

    for await (const msg of cursor) {
      stats.checked += 1;
      const exists = await ConversationMessage.exists({
        $or: [
          { relayMessageId: msg._id },
          { source: 'relay', messageId: msg._id },
        ],
      });

      if (!exists) {
        stats.missingInHistory += 1;
        if (repair) {
          try {
            await appendMessageToHistory({
              convId: msg.conversation?.threadId,
              participants: [msg.from, msg.to],
              sender: msg.from,
              relayMessageId: msg._id,
              source: 'relay',
              messageId: msg._id,
              box: msg.box,
              boxSize: msg.boxSize,
              iv: msg.iv,
              messageType: msg.messageType,
              meta: msg.meta,
              createdAt: msg.timestamps?.enqueuedAt || msg.createdAt,
            });
            stats.repaired += 1;
          } catch (error) {
            stats.repairFailed += 1;
            log.error('reconcile_repair_failed', {
              relayMessageId: msg._id,
              error: error?.message || error,
            });
          }
        }
      }
    }

    log.info('reconcile_finish', {
      durationMs: Date.now() - started,
      ...stats,
    });

    return stats;
  } catch (error) {
    log.error('reconcile_error', { error: error?.message || error });
    throw error;
  }
}

export default reconcileRelayHistory;
