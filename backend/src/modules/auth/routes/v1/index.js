import { Router } from 'express';
import publicRoutes from './public.js';
import privateRoutes from './private.js';
import { protectRoute } from '#middleware/authMiddleware.js';

const router = Router();

/** Compatibilidad: endpoints clásicos (sin prefijos) */
router.use('/', publicRoutes);
router.use('/', protectRoute, privateRoutes);

/** Versión explícita v1 con audiencias */
router.use('/public', publicRoutes);
router.use('/me', protectRoute, privateRoutes);

export default router;
