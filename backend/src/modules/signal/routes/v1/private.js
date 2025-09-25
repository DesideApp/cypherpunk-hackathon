import { Router } from 'express';
import {
  sendSignal,
  retrieveSignal
} from '#modules/signal/controllers/signal.controller.js';

const router = Router();

/** Privado (JWT) → el protectRoute se aplica en v1/index.js
 *  POST /api/signal/             (compat)
 *  GET  /api/signal/:pubkey      (compat)
 *  POST /api/signal/v1/me        (v1)
 *  GET  /api/signal/v1/me/:pubkey (v1)
 */
router.post('/', sendSignal);
router.get('/:pubkey', retrieveSignal);

export default router;
