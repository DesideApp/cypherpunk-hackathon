import { Router } from 'express';
import { getSignalStatus } from '#modules/signal/controllers/signal.controller.js';

const router = Router();

/** Público
 *  GET /api/signal/            (compat)
 *  GET /api/signal/v1/public   (v1)
 */
router.get('/', getSignalStatus);

export default router;
