import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { executeBlink } from '../../controllers/executeBlink.controller.js';
import { executeBuyBlink, getBuyBlinkMetadata } from '../../controllers/buyBlink.controller.js';

const router = Router();

const executeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const configLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 50, // 50 requests por ventana
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/execute', executeLimiter, executeBlink);
router
  .route('/buy')
  .get(configLimiter, getBuyBlinkMetadata)
  .post(executeLimiter, executeBuyBlink);

export default router;
