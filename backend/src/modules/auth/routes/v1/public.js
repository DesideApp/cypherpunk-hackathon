import { Router } from 'express';
import {
  loginUser,
  refreshToken,
  generateNonce,
} from '#modules/auth/controllers/auth.controller.js';
import { detectCountry } from '#middleware/geoMiddleware.js';

const router = Router();

// Público (sin protectRoute)
router.post('/auth', detectCountry, loginUser);
router.post('/refresh', refreshToken);
router.get('/nonce', generateNonce);

export default router;
