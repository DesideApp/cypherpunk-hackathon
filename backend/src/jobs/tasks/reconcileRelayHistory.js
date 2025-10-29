// src/jobs/tasks/reconcileRelayHistory.js
import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import ConversationMessage from '#modules/history/models/message.model.js';
import { appendMessageToHistory } from '#modules/history/services/history.service.js';
import { createModuleLogger } from '#config/logger.js';
import {
  relayHistoryDriftGauge,
  relayHistoryRepairCounter,
  relayHistoryDriftHistoryGauge,
} from '#modules/relay/services/relayMetrics.js';

const log = createModuleLogger({ module: 'jobs.reconcileRelayHistory' });

const DEFAULT_BATCH_SIZE = Number.parseInt(process.env.RECONCILE_BATCH_SIZE ?? '500', 10);

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

  const cursor = RelayMessage.find({}, null, { lean: true }).cursor();

  for await (const msg of cursor) {
    stats.checked += 1;
    const exists = await ConversationMessage.exists({ relayMessageId: msg._id });
    if (!exists) {
      stats.missingInHistory += 1;
      if (repair) {
        try {
          await appendMessageToHistory({
            convId: msg.conversation?.threadId,
            participants: [msg.from, msg.to],
            sender: msg.from,
            relayMessageId: msg._id,
            clientMsgId: msg.meta?.clientId,
            box: msg.box,
            boxSize: msg.boxSize,
            iv: msg.iv,
            messageType: msg.messageType,
            meta: msg.meta,
            createdAt: msg.timestamps?.enqueuedAt || msg.createdAt,
          });
          stats.repaired += 1;
          relayHistoryRepairCounter.inc();
        } catch (error) {
          stats.repairFailed += 1;
          log.error('reconcile_repair_failed', {
            relayMessageId: msg._id,
            error: error?.message || error,
          });
        }
      }
    }

    if (batchSize > 0 && stats.checked >= batchSize) break;
  }

  relayHistoryDriftGauge.set(Math.max(stats.missingInHistory - stats.repaired, 0));

  if (checkHistory) {
    let checkedHistory = 0;
    const historyCursor = ConversationMessage.find(
      { relayMessageId: { $exists: true } },
      { relayMessageId: 1 },
      { lean: true }
    ).cursor();
    for await (const record of historyCursor) {
      const existsInRelay = await RelayMessage.exists({ _id: record.relayMessageId });
      if (!existsInRelay) {
        stats.missingInRelay += 1;
      }
      checkedHistory += 1;
      if (batchSize > 0 && checkedHistory >= batchSize) break;
    }
    relayHistoryDriftHistoryGauge.set(stats.missingInRelay);
  }

  log.info('reconcile_finish', {
    durationMs: Date.now() - started,
    ...stats,
  });

  return stats;
}

export default reconcileRelayHistory;
