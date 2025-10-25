import { Router } from 'express';
import { listRelayPending, getRelayOverview } from '../../controllers/adminRelay.controller.js';

const router = Router();

// Public (requires session via protectRoute at mount)
router.get('/pending', listRelayPending);
router.get('/overview', getRelayOverview);

export default router;

