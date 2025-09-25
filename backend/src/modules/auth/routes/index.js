import { Router } from 'express';
import v1 from './v1/index.js';

const router = Router();

// Por defecto y versión explícita
router.use('/', v1);
router.use('/v1', v1);

export default router;
