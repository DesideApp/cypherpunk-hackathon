import { Router } from 'express';
import { listUsers, listRecentLogins, listTopUsers } from '../../controllers/adminUsers.controller.js';
import { listRelayUsage, listRelayPending, getRelayOverview } from '../../controllers/adminRelay.controller.js';
import { getInfraOverview } from '../../controllers/adminInfra.controller.js';
import { getAdoptionOverview, getCohorts, getFunnel } from '../../controllers/adminAdoption.controller.js';

const router = Router();

// Users table for admin panel
router.get('/users', listUsers);
router.get('/users/recent-logins', listRecentLogins);
router.get('/users/top', listTopUsers);

// Relay usage rankings
router.get('/relay/usage', listRelayUsage);
router.get('/relay/pending', listRelayPending);
router.get('/relay/overview', getRelayOverview);

// Infra overview (HTTP APM)
router.get('/infra/overview', getInfraOverview);

// Adoption & cohorts
router.get('/adoption/overview', getAdoptionOverview);
router.get('/adoption/cohorts', getCohorts);
router.get('/adoption/funnel', getFunnel);

export default router;
