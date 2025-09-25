import { Router } from 'express';
import {
  getContacts,
  sendContactRequest,
  acceptContactRequest,
  removeContact,
  blockContact,
  unblockContact,
  getContactStatus,
} from '#modules/contacts/controllers/contacts.controller.js';

const router = Router();

/**
 * Privado (JWT) — el protectRoute se aplica en v1/index.js
 * GET /api/contacts/v1/me/
 * GET /api/contacts/v1/me/status/:pubkey
 * POST /api/contacts/v1/me/send
 * ...
 * (y compat en /api/contacts/*)
 */
router.get('/', getContacts);
router.get('/status/:pubkey', getContactStatus);
router.post('/send', sendContactRequest);
router.post('/accept', acceptContactRequest);
router.delete('/remove', removeContact);
router.post('/block', blockContact);
router.post('/unblock', unblockContact);

export default router;
