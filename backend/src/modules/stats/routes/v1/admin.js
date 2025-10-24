import { Router } from 'express';
import { listUsers } from '../../controllers/adminUsers.controller.js';

const router = Router();

// Users table for admin panel
router.get('/users', listUsers);

export default router;
