import { Router } from 'express';
import { findUserByPubkey } from '#modules/users/controllers/user.controller.js';

const router = Router();

/** Público
 *  GET /api/users/:pubkey        (compat)
 *  GET /api/users/v1/public/:pubkey (v1)
 */
router.get('/:pubkey', findUserByPubkey);

export default router;
