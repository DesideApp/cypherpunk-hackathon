// src/modules/activity/routes/v1/index.js
import { Router } from 'express';

import {
  listActivityEvents,
  listActivityTrends,
} from '../../controllers/activityFeed.controller.js';

const router = Router();

router.get('/events', listActivityEvents);
router.get('/trends', listActivityTrends);

export default router;
