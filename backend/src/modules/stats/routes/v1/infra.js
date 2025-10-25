import { Router } from 'express';
import { getInfraOverview } from '../../controllers/adminInfra.controller.js';

const router = Router();

// Public (requires session via protectRoute at mount)
router.get('/overview', getInfraOverview);

export default router;

