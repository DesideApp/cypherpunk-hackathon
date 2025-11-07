import { Router } from 'express';
import {
  listRelayAbuseFlags,
  unblockRelayEntity,
} from '#modules/relay/controllers/relay.controller.js';

const router = Router();

router.get('/abuse/flags', listRelayAbuseFlags);
router.post('/abuse/unblock', unblockRelayEntity);

export default router;
