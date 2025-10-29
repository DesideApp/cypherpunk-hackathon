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

const router = Router();

/**
 * Todas privadas (JWT) — protectRoute se aplica en v1/index.js
 * Compat: /api/relay/*
 * v1:     /api/relay/v1/me/*
 */

router.post('/enqueue', enqueueMessage);
router.get('/fetch', fetchMessages);
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

export default router;
