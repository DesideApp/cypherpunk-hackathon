import { Router } from 'express';
import Contact from '#modules/contacts/models/contact.model.js'; // ⬅️ si lo renombraste: 'contact.model.js'
import { dmStartLimiter, perUserPendingLimiter } from '#middleware/rateLimitDM.js';
import {
  sendInitialMessage,
  acceptDMRequest,
  rejectDMRequest,
  cancelDMRequest,
  blockPeer,
  listDMs,
} from '#modules/dm/controllers/dm.controller.js';

const router = Router();

/**
 * Privado (JWT) — el protectRoute se aplica en v1/index.js
 * POST /api/dm/v1/me/start
 * ...
 * (y compat /api/dm/*)
 */
router.post('/start', dmStartLimiter, perUserPendingLimiter(Contact), sendInitialMessage);
router.post('/accept', acceptDMRequest);
router.post('/reject', rejectDMRequest);
router.post('/cancel', cancelDMRequest);
router.post('/block', blockPeer);
router.get('/', listDMs);

export default router;
