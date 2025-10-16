import { Router } from 'express';
import { getStatsOverview } from '../controllers/overview.controller.js';

const router = Router();

router.get('/overview', getStatsOverview);

export default router;
