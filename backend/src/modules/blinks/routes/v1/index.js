import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { executeBlink } from '../../controllers/executeBlink.controller.js';

const router = Router();

const executeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/execute', executeLimiter, executeBlink);

export default router;
