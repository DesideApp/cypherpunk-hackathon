import { Router } from 'express';
import {
  checkWalletExists,
} from '#modules/contacts/controllers/contacts.controller.js';

const router = Router();

/**
 * Público (sin JWT)
 * GET /api/contacts/v1/public/check/:pubkey
 * GET /api/contacts/check/:pubkey   ← compat
 */
router.get('/check/:pubkey', checkWalletExists);

export default router;
