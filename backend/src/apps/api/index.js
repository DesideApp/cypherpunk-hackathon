// src/apps/api/index.js
import { Router } from 'express';
import v1 from './v1/router.js';

/**
 * Normaliza trailing slash:
 * /api/v1/policy/ → 308 → /api/v1/policy
 */
function normalizeTrailingSlash(req, res, next) {
  if (req.path !== '/' && req.path.endsWith('/')) {
    const clean = req.originalUrl.replace(/\/+$/, '');
    return res.redirect(308, clean);
  }
  next();
}

/**
 * Versionado menor:
 * Acepta X-API-Minor, X-Deside-Version o ?minor=1.1 (fallback a API_MINOR_DEFAULT o 1.0)
 */
function minorVersioning(req, res, next) {
  const fromHdr1 = req.header('X-API-Minor');
  const fromHdr2 = req.header('X-Deside-Version');
  const fromQuery = req.query?.minor;
  const minor = fromHdr1 || fromHdr2 || fromQuery || process.env.API_MINOR_DEFAULT || '1.0';

  req.apiMinor = minor;
  res.setHeader('X-API-Major', '1');
  res.setHeader('X-API-Minor', minor);
  next();
}

/**
 * Monta las versiones de API.
 * Flags:
 * - API_LEGACY_ALIAS=true        → /api (alias de /api/v1)
 */
export function mountApi(app, { basePath = '/api' } = {}) {
  const api = Router();

  api.use(normalizeTrailingSlash);
  api.use(minorVersioning);

  // Major 1
  api.use('/v1', v1);

  // Alias de transición: /api → /api/v1
  if ((process.env.API_LEGACY_ALIAS || '').toLowerCase() === 'true') {
    api.use('/', v1);
  }

  app.use(basePath, api);

}
