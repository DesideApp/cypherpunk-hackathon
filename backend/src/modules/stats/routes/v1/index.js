import { Router } from 'express';
import { protectRoute } from '#middleware/authMiddleware.js';
import { adminProtect } from '#middleware/adminProtect.js';

import overviewRoutes from './overview.js';
import adminRoutes from './admin.js';

const router = Router();

/**
 * Overview metrics for authenticated users.
 * Keeping it private (JWT) for now; premium tier to be added later.
 */
router.use('/overview', protectRoute, overviewRoutes);

/**
 * Admin endpoints (CSV exports, deep analytics).
 * Currently placeholder handlers; real controllers will land after the hackathon.
 */
router.use('/admin', protectRoute, adminProtect, adminRoutes);

export default router;
