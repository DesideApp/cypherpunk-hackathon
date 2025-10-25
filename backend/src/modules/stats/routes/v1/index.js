import { Router } from 'express';
import { protectRoute } from '#middleware/authMiddleware.js';
import { adminProtect } from '#middleware/adminProtect.js';

import overviewRoutes from './overview.js';
import adminRoutes from './admin.js';
import infraRoutes from './infra.js';
import relayRoutes from './relay.js';
import adoptionRoutes from './adoption.js';

const router = Router();

/**
 * Overview metrics for authenticated users.
 * Keeping it private (JWT) for now; premium tier to be added later.
 */
router.use('/overview', protectRoute, overviewRoutes);

// Public (session-protected) aliases for panels (no adminProtect)
router.use('/infra', protectRoute, infraRoutes);
router.use('/relay', protectRoute, relayRoutes);
router.use('/adoption', protectRoute, adoptionRoutes);

/**
 * Admin endpoints (CSV exports, deep analytics).
 * Currently placeholder handlers; real controllers will land after the hackathon.
 */
router.use('/admin', protectRoute, adminProtect, adminRoutes);

export default router;
