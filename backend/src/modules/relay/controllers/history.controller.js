import logger from '#config/logger.js';
import { appendMessageToHistory } from '#modules/history/services/history.service.js';
import {
  prepareHistorySyncPayload,
  mapToHistoryAppendArgs,
  HistorySyncValidationError,
} from '#shared/services/historySync.service.js';
import {
  recordHistorySyncAttempt,
  recordHistorySyncSuccess,
  recordHistorySyncFailure,
} from '#modules/relay/services/relayMetrics.js';
import {
  shouldBlock as shouldBlockAbuse,
  recordAbuseEvent,
} from '#modules/relay/services/relayAbuse.service.js';

function respondWithAbuseBlock(req, res, block) {
  if (!block) return false;
  if (Number.isFinite(block.retryAfterSeconds) && block.retryAfterSeconds > 0) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(block.retryAfterSeconds))));
  }
  logger.warn('[relay] abuse block response', {
    wallet: req.user?.wallet || null,
    ip: req.ip,
    reason: block.reason || 'abuse',
    retryAfterSeconds: block.retryAfterSeconds ?? null,
  });
  res.status(429).json({
    error: 'temporarily_blocked',
    detail: {
      reason: block.reason || 'abuse',
      retryAfterSeconds: block.retryAfterSeconds ?? null,
    },
  });
  return true;
}

/**
 * POST /api/relay/history/rtc
 * Permite que clientes RTC reflejen mensajes entregados en el historial.
 * Requiere JWT; el sender final debe coincidir con el wallet autenticado.
 */
export async function postRtcHistoryMessage(req, res) {
  let historySource = 'rtc';
  let normalizedPayload;
  try {
    const wallet = req.user?.wallet;
    if (!wallet) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (respondWithAbuseBlock(req, res, shouldBlockAbuse({ scope: 'wallet', id: wallet }))) {
      return;
    }

    const rawPayload = {
      ...req.body,
      source: 'rtc',
      sender: req.body?.sender || wallet,
    };

    normalizedPayload = prepareHistorySyncPayload(rawPayload);
    historySource = normalizedPayload?.source || 'rtc';

    if (normalizedPayload.sender !== wallet) {
      recordHistorySyncFailure(historySource, 'sender_mismatch');
      recordAbuseEvent({ scope: 'wallet', id: wallet, reason: 'sender_mismatch' });
      return res.status(403).json({ error: 'forbidden', detail: 'sender_mismatch' });
    }

    // map to history arguments while mantaining compatibility with current implementation
    const historyArgs = mapToHistoryAppendArgs(normalizedPayload);
    if (!historyArgs.relayMessageId && historyArgs.messageId) {
      historyArgs.relayMessageId = historyArgs.messageId;
    }

    recordHistorySyncAttempt(historySource);
    const result = await appendMessageToHistory(historyArgs);
    recordHistorySyncSuccess(historySource, result?.existing);

    logger.info('[relay] rtc→history append success', {
      source: historySource,
      convId: result?.convId,
      seq: result?.seq,
      messageId: normalizedPayload.messageId,
    });

    return res.status(200).json({
      status: 'ok',
      convId: result?.convId,
      seq: result?.seq,
      existing: Boolean(result?.existing),
    });
  } catch (err) {
    if (err instanceof HistorySyncValidationError) {
      recordHistorySyncFailure(historySource, 'validation');
      if (req?.user?.wallet) {
        recordAbuseEvent({ scope: 'wallet', id: req.user.wallet, reason: 'history_validation_failed' });
      }
      return res.status(err.statusCode || 400).json({
        error: 'invalid_payload',
        details: err.details || [],
      });
    }

    const reason =
      typeof err?.code === 'string' ? err.code :
      typeof err?.name === 'string' ? err.name :
      (err?.message && err.message.includes('duplicate')) ? 'duplicate' :
      'exception';
    recordHistorySyncFailure(historySource, reason);

    logger.warn('[relay] rtc→history append failed', {
      error: err?.message,
    });
    return res.status(500).json({ error: 'history_sync_failed' });
  }
}
