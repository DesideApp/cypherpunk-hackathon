import { Router } from 'express';
import { getAdoptionOverview, getCohorts, getFunnel } from '../../controllers/adminAdoption.controller.js';

const router = Router();

// Public (requires session via protectRoute at mount)
router.get('/overview', getAdoptionOverview);
router.get('/cohorts', getCohorts);
router.get('/funnel', getFunnel);

export default router;

