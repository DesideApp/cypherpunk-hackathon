import { Router } from 'express';
import {
  enqueueMessage,
  fetchMessages,
  ackMessages,
  getRelayPolicy,
  getRelayConfig,
  getRelayUsage,
  purgeRelayMailbox,
} from '#modules/relay/controllers/relay.controller.js';
import { postRtcHistoryMessage } from '#modules/relay/controllers/history.controller.js';
import {
  relayEnqueueWalletLimiter,
  relayEnqueueIpLimiter,
  relayHistoryRtcWalletLimiter,
  relayHistoryRtcIpLimiter,
  relayFetchWalletLimiter,
  relayFetchIpLimiter,
  relayAttachmentWalletLimiter,
  relayAttachmentIpLimiter,
} from '#middleware/rateLimitRelay.js';
import {
  postPresignAttachment,
  getAttachmentDownloadUrl,
} from '#modules/attachments/controllers/attachment.controller.js';

const router = Router();

/**
 * Todas privadas (JWT) — protectRoute se aplica en v1/index.js
 * Compat: /api/relay/*
 * v1:     /api/relay/v1/me/*
 */

router.post('/enqueue', relayEnqueueWalletLimiter, relayEnqueueIpLimiter, enqueueMessage);
router.get('/fetch', relayFetchWalletLimiter, relayFetchIpLimiter, fetchMessages);
router.post('/ack', ackMessages);
router.get('/policy', getRelayPolicy);
router.get('/config', getRelayConfig);

/**
 * GET /usage — incluye campos legacy para UIs antiguas.
 */
router.get('/usage', getRelayUsage);

/**
 * POST /purge — borra todo el buzón Relay del usuario y recalcula usedBytes.
 */
router.post('/purge', purgeRelayMailbox);

/**
 * POST /history/rtc — ingesta de mensajes RTC hacia history.
 */
router.post(
  '/history/rtc',
  relayHistoryRtcWalletLimiter,
  relayHistoryRtcIpLimiter,
  postRtcHistoryMessage,
);

router.post(
  '/attachments/presign',
  relayAttachmentWalletLimiter,
  relayAttachmentIpLimiter,
  postPresignAttachment,
);

router.get(
  '/attachments/:objectKey/presign',
  getAttachmentDownloadUrl,
);

export default router;
