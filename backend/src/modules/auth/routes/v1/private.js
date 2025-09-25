import { Router } from 'express';
import {
  checkAuthStatus,
  logoutUser,
} from '#modules/auth/controllers/auth.controller.js';

const router = Router();

// Privado (se protege en v1/index.js)
router.get('/status', checkAuthStatus);
router.post('/revoke', logoutUser);

export default router;
