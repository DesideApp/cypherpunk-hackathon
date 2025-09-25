import { Router } from 'express';
import v1 from './v1/index.js';

const router = Router();

/**
 * Montajes equivalentes para compatibilidad:
 * - /api/relay/*
 * - /api/relay/v1/*
 */
router.use('/', v1);
router.use('/v1', v1);

export default router;
