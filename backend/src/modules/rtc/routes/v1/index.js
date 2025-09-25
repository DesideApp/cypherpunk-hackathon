// src/modules/rtc/routes/v1/index.js
import { Router } from 'express';
import { protectRoute } from '#middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import { getIceServers } from '#modules/rtc/controllers/ice.controller.js';

const router = Router();

// Límite suave: 10 req/min por usuario (o IP como fallback)
const iceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.wallet || req.ip,
  message: { error: 'rate_limited', detail: 'Too many ICE requests. Slow down.' },
});

// GET /api/rtc/ice — emite credenciales TURN efímeras (privada + flag)
router.get('/ice', protectRoute, iceLimiter, getIceServers);

export default router;
