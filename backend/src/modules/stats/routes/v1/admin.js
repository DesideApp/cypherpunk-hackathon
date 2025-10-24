import { Router } from 'express';
import { listUsers, listRecentLogins, listTopUsers } from '../../controllers/adminUsers.controller.js';
import { listRelayUsage } from '../../controllers/adminRelay.controller.js';

const router = Router();

// Users table for admin panel
router.get('/users', listUsers);
router.get('/users/recent-logins', listRecentLogins);
router.get('/users/top', listTopUsers);

// Relay usage rankings
router.get('/relay/usage', listRelayUsage);

export default router;
