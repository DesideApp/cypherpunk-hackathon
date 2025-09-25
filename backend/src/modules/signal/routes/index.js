import { Router } from 'express';
import v1 from './v1/index.js';

// Este index es el "entry" del módulo SIS. Desde server.js montas /api/sis sobre él.
const router = Router();
router.use('/v1', v1);

export default router;
