// src/modules/link-preview/controllers/linkPreview.controller.js
import logger from '#config/logger.js';
import { getLinkPreviewData } from '../services/linkPreview.service.js';

const KNOWN_CLIENT_ERRORS = [
  'Missing url parameter',
  'Invalid URL format',
  'Only HTTP/HTTPS URLs are allowed',
  'Private hostname not allowed',
  'Host has no DNS records',
  'Host resolves only to private addresses',
];

/**
 * Controlador para obtener preview de un link
 * @param {import('express').Request} req - Request object
 * @param {import('express').Response} res - Response object
 */
export async function getLinkPreview(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }

    const data = await getLinkPreviewData(String(url));

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    const message = error?.message || 'Failed to get link preview';

    if (error?.name === 'AbortError') {
      logger.warn(`[link-preview] Timeout fetching URL: ${message}`);
      return res.status(504).json({ success: false, error: 'Link preview timed out' });
    }

    if (KNOWN_CLIENT_ERRORS.some((known) => message.includes(known))) {
      return res.status(400).json({ success: false, error: message });
    }

    logger.error('Error getting link preview:', error);
    return res.status(500).json({ success: false, error: 'Failed to get link preview' });
  }
}
