import { Router } from 'express';
import { updateMyProfile } from '#modules/users/controllers/profile.controller.js';
import { rotateCSRFToken } from '#middleware/authMiddleware.js';

const router = Router();

// Privadas (JWT aplicado en v1/index.js)
router.put('/profile', rotateCSRFToken, updateMyProfile);

export default router;

