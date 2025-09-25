import { Router } from 'express';
import publicRoutes from './public.js';
import privateRoutes from './private.js';
import { protectRoute } from '#middleware/authMiddleware.js';

const router = Router();

/** Compat: /api/signal/... */
router.use('/', publicRoutes);
// Legacy HTTP signal routes (deprecated): gate by feature flag rtc.legacySignal
router.use('/', protectRoute, privateRoutes);

/** v1 explícito */
router.use('/public', publicRoutes);
router.use('/me', protectRoute, privateRoutes);

export default router;
