import { Router } from 'express';
import privateRoutes from './private.js';
import { protectRoute } from '#middleware/authMiddleware.js';

const router = Router();

/** Compat: /api/relay/* (todo protegido) */
router.use('/', protectRoute, privateRoutes);

/** v1 explícito: /api/relay/v1/me/* */
router.use('/me', protectRoute, privateRoutes);

export default router;
