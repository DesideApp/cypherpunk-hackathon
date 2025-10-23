import { Router } from 'express';
import { findUserByPubkey, findUsersByPubkeys } from '#modules/users/controllers/user.controller.js';
import { protectRoute } from '#middleware/authMiddleware.js';

const router = Router();

/** Público
 *  GET /api/users/:pubkey        (compat)
 *  GET /api/users/v1/public/:pubkey (v1)
 */
router.get('/:pubkey', findUserByPubkey);
router.post('/batch', protectRoute, findUsersByPubkeys);

export default router;
