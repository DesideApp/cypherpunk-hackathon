import logger from '#config/logger.js';
import { validateHistorySyncPayload, HistorySyncValidationError } from '#shared/dto/historySyncPayload.js';

/**
 * Procesa un payload crudo (relay o rtc), valida y devuelve la forma normalizada que espera History.
 * @param {object} rawPayload
 * @returns {HistorySyncPayload}
 * @throws {HistorySyncValidationError}
 */
export function prepareHistorySyncPayload(rawPayload) {
  return validateHistorySyncPayload(rawPayload);
}

/**
 * Convierte el payload normalizado en los argumentos que `appendMessageToHistory` necesita actualmente.
 * Permite futuras adaptaciones (adjuntos, timestamps adicionales).
 */
export function mapToHistoryAppendArgs(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new HistorySyncValidationError('Payload must be validated before mapping', [
      { field: 'payload', code: 'invalid_type', message: 'Expected validated payload' },
    ]);
  }

  const {
    convId,
    participants,
    sender,
    relayMessageId,
    clientMsgId,
    box,
    boxSize,
    iv,
    messageType,
    meta,
    createdAt,
    timestamps,
    source,
    messageId,
    attachments,
  } = payload;

  return {
    convId,
    participants,
    sender,
    relayMessageId,
    clientMsgId: clientMsgId || undefined,
    box,
    boxSize,
    iv,
    messageType,
    meta,
    createdAt,
    timestamps,
    source,
    messageId,
    attachments,
  };
}

/**
 * Punto de entrada centralizado (a completar cuando History acepte ambos sources).
 * Centraliza logging/telemetría para relay y rtc.
 */
export async function appendHistoryMessage(rawPayload, { appendImpl } = {}) {
  const prepared = prepareHistorySyncPayload(rawPayload);
  logger.debug('[historySync] normalized payload', {
    source: prepared.source,
    convId: prepared.convId,
    relayMessageId: prepared.relayMessageId,
    messageId: prepared.messageId,
    messageType: prepared.messageType,
  });

  if (typeof appendImpl === 'function') {
    return appendImpl(prepared);
  }

  // Placeholder: los módulos que consuman este servicio deben proporcionar appendImpl
  // hasta que History implemente soporte completo para ambos sources.
  return prepared;
}

export { HistorySyncValidationError } from '#shared/dto/historySyncPayload.js';
