// src/modules/link-preview/routes/index.js
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getLinkPreview } from '../controllers/linkPreview.controller.js';

const router = Router();

const previewLimiter = rateLimit({
  windowMs: Number(process.env.LINK_PREVIEW_WINDOW_MS ?? 60_000),
  max: Number(process.env.LINK_PREVIEW_MAX_REQUESTS ?? 45),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many link preview requests. Slow down.',
  },
});

/**
 * GET /api/v1/link-preview
 * Obtener preview de un link
 * 
 * Query params:
 * - url: URL del link a previsualizar
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://example.com",
 *     "title": "Título del sitio",
 *     "description": "Descripción del sitio",
 *     "image": "https://example.com/image.jpg",
 *     "siteName": "Example.com",
 *     "favicon": "https://example.com/favicon.ico"
 *   }
 * }
 */
router.get('/', previewLimiter, getLinkPreview);

export default router;







