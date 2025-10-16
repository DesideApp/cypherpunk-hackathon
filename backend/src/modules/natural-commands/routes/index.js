// src/modules/natural-commands/routes/index.js
// Rutas para comandos naturales

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protectRoute } from '#middleware/authMiddleware.js';
import { adminProtect } from '#middleware/adminProtect.js';

import {
  parseNaturalCommand,
  getAvailableActions,
  registerAction,
  validateCommand
} from '../controllers/naturalCommands.controller.js';

const router = Router();

// Rate limiting
const commandLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 comandos por minuto
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many command requests. Please wait a moment.'
  }
});

const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 acciones de admin por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'ADMIN_RATE_LIMIT_EXCEEDED',
    message: 'Too many admin requests. Please wait.'
  }
});

// Rutas públicas (sin autenticación)
router.get('/actions', getAvailableActions);

// Rutas protegidas (requieren autenticación)
router.post('/parse', protectRoute, commandLimiter, parseNaturalCommand);
router.post('/validate', protectRoute, commandLimiter, validateCommand);

// Rutas de administración (requieren rol admin)
router.post('/register', protectRoute, adminProtect, adminLimiter, registerAction);

export default router;






