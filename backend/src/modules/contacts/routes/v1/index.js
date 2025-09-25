import { Router } from 'express';
import publicRoutes from './public.js';
import privateRoutes from './private.js';
import { protectRoute } from '#middleware/authMiddleware.js';

const router = Router();

/** Compatibilidad: endpoints “clásicos” sin prefijo */
router.use('/', publicRoutes);                 // /api/contacts/check/:pubkey
router.use('/', protectRoute, privateRoutes);  // /api/contacts/* (resto)

/** Versión explícita v1 */
router.use('/public', publicRoutes);
router.use('/me', protectRoute, privateRoutes);

export default router;
