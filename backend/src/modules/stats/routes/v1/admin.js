import { Router } from 'express';

const router = Router();

/**
 * Placeholder admin router.
 * The detailed analytics/exports from the original backend will be ported after the hackathon.
 */
router.all('*', (_req, res) => {
  res.status(501).json({
    error: 'STATS_ADMIN_NOT_AVAILABLE',
    message: 'Advanced stats endpoints will be restored after the hackathon.'
  });
});

export default router;
