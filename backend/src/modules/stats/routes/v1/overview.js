import { Router } from 'express';
import { getStatsOverview } from '../../controllers/overview.controller.js';

const router = Router();

// GET /api/v1/stats/overview
router.get('/', getStatsOverview);

export default router;
