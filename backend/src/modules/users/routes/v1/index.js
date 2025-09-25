import { Router } from 'express';
import publicRoutes from './public.js';
import privateRoutes from './private.js';
import { protectRoute } from '#middleware/authMiddleware.js';

const router = Router();

/** Compat + v1 explícito */
router.use('/', publicRoutes);                 // /api/users/:pubkey
router.use('/', protectRoute, privateRoutes);  // /api/users/profile (compat)

router.use('/public', publicRoutes);
router.use('/me', protectRoute, privateRoutes); // /api/users/v1/me/profile

export default router;
