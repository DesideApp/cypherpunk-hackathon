import logger from '#config/logger.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_SOURCES = new Set(['relay', 'rtc']);

function toDate(value, field, errors) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date?.getTime())) {
    errors.push({ field, code: 'invalid_date', message: `${field} must be a valid date` });
    return null;
  }
  return date;
}

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length ? trimmed : '';
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  return meta;
}

export class HistorySyncValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'HistorySyncValidationError';
    this.code = 'history_sync_invalid_payload';
    this.statusCode = 400;
    this.details = details || [];
  }
}

/**
 * Normaliza y valida el payload base que comparten Relay y RTC antes de tocar History.
 * Devuelve un objeto listo para pasar al servicio de historial.
 */
export function validateHistorySyncPayload(rawPayload) {
  const errors = [];
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : null;

  if (!payload) {
    throw new HistorySyncValidationError('Payload must be an object', [
      { field: 'payload', code: 'invalid_type', message: 'Expected object' },
    ]);
  }

  const rawSource = normalizeString(payload.source).toLowerCase();
  const source = rawSource && VALID_SOURCES.has(rawSource) ? rawSource : 'relay';
  if (rawSource && !VALID_SOURCES.has(rawSource)) {
    errors.push({ field: 'source', code: 'invalid_source', message: 'Source must be relay or rtc' });
  }

  const conversationId = normalizeString(payload.convId) || normalizeString(payload.conversationId);
  const sender = normalizeString(payload.sender || payload.from || payload.senderWallet);

  const participantsSet = new Set();
  if (Array.isArray(payload.participants)) {
    for (const value of payload.participants) {
      const normalized = normalizeString(value);
      if (normalized) participantsSet.add(normalized);
    }
  }

  const participants = Array.from(participantsSet).sort();
  if (participants.length < 2) {
    errors.push({ field: 'participants', code: 'invalid_participants', message: 'Need at least two participants' });
  }

  if (!sender) {
    errors.push({ field: 'sender', code: 'required', message: 'Sender is required' });
  } else if (!participants.includes(sender)) {
    errors.push({ field: 'sender', code: 'not_in_participants', message: 'Sender must be part of participants' });
  }

  const box = normalizeString(payload.box || payload.payload);
  if (!box) {
    errors.push({ field: 'box', code: 'required', message: 'box (encrypted payload) is required' });
  }

  const boxSize = Number.isFinite(payload.boxSize) ? payload.boxSize : Number(payload.boxSize);
  if (!Number.isFinite(boxSize) || boxSize < 0) {
    errors.push({ field: 'boxSize', code: 'invalid_number', message: 'boxSize must be a non-negative number' });
  }

  const iv = normalizeString(payload.iv);
  const messageType = normalizeString(payload.messageType) || 'text';
  const meta = normalizeMeta(payload.meta);
  const clientMsgId = normalizeString(payload.clientMsgId);

  let attachments = undefined;
  if (Array.isArray(payload.attachments) && payload.attachments.length) {
    attachments = payload.attachments
      .map(att => {
        const key = normalizeString(att?.key);
        if (!key) return null;
        const bucket = normalizeString(att?.bucket) || undefined;
        const mimeType = normalizeString(att?.mimeType) || 'application/octet-stream';
        const sizeBytes = Number.isFinite(att?.sizeBytes) ? att.sizeBytes : Number(att?.sizeBytes);
        if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
          errors.push({ field: 'attachments.sizeBytes', code: 'invalid_number', message: 'sizeBytes must be >= 0' });
          return null;
        }
        const hash = normalizeString(att?.hash) || null;
        const thumbnailKey = normalizeString(att?.thumbnailKey) || null;
        const expiresAt = toDate(att?.expiresAt, 'attachments.expiresAt', errors);
        return {
          key,
          bucket,
          mimeType,
          sizeBytes,
          hash,
          thumbnailKey,
          expiresAt,
        };
      })
      .filter(Boolean);
    if (!attachments.length) attachments = undefined;
  }

  let relayMessageId = normalizeString(payload.relayMessageId || payload.messageId);
  const messageId = normalizeString(payload.messageId);

  if (relayMessageId && !UUID_V4.test(relayMessageId)) {
    errors.push({ field: 'relayMessageId', code: 'invalid_uuid', message: 'relayMessageId must be a UUID v4' });
  }

  if (messageId && !UUID_V4.test(messageId)) {
    errors.push({ field: 'messageId', code: 'invalid_uuid', message: 'messageId must be a UUID v4' });
  }

  if (source === 'relay') {
    if (!relayMessageId && messageId) {
      relayMessageId = messageId;
    }
    if (!relayMessageId) {
      errors.push({ field: 'relayMessageId', code: 'required', message: 'relayMessageId is required for relay source' });
    }
  } else if (source === 'rtc') {
    if (!messageId) {
      errors.push({ field: 'messageId', code: 'required', message: 'messageId is required for rtc source' });
    }
  }

  const normalizedMessageId = messageId || relayMessageId || null;
  const normalizedRelayMessageId = relayMessageId || null;

  const createdAt = toDate(payload.createdAt, 'createdAt', errors) || new Date();
  const timestamps = {};
  const deliveredAt = toDate(payload?.timestamps?.deliveredAt, 'timestamps.deliveredAt', errors);
  const acknowledgedAt = toDate(payload?.timestamps?.acknowledgedAt, 'timestamps.acknowledgedAt', errors);
  if (deliveredAt) timestamps.deliveredAt = deliveredAt;
  if (acknowledgedAt) timestamps.acknowledgedAt = acknowledgedAt;
  const hasTimestamps = Object.keys(timestamps).length > 0;

  if (errors.length) {
    logger.debug(`[historySync] payload validation failed`, { errors });
    throw new HistorySyncValidationError('Invalid history sync payload', errors);
  }

  return {
    source,
    convId: conversationId || null,
    participants,
    sender,
    relayMessageId: normalizedRelayMessageId,
    messageId: normalizedMessageId,
    clientMsgId: clientMsgId || null,
    box,
    boxSize,
    iv: iv || null,
    messageType,
    meta,
    createdAt,
    timestamps: hasTimestamps ? timestamps : undefined,
    attachments,
  };
}
