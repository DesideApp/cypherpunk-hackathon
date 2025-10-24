import { Router } from 'express';
import { protectRoute } from '#middleware/authMiddleware.js';
import { uploadAvatar } from '#modules/uploads/controllers/uploads.controller.js';

const router = Router();

// Auth required: writes to server public dir
router.post('/avatar', protectRoute, uploadAvatar);

export default router;

