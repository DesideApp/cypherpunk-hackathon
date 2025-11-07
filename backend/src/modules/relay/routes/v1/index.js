import { Router } from 'express';
import privateRoutes from './private.js';
import adminRoutes from './admin.js';
import { protectRoute } from '#middleware/authMiddleware.js';
import { adminProtect } from '#middleware/adminProtect.js';

const router = Router();

/** Admin: /api/relay/admin/* */
router.use('/admin', protectRoute, adminProtect, adminRoutes);

/** Compat: /api/relay/* (todo protegido) */
router.use('/', protectRoute, privateRoutes);

/** v1 explícito: /api/relay/v1/me/* */
router.use('/me', protectRoute, privateRoutes);

export default router;
