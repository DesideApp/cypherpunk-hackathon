import { createRequire } from 'module';
import crypto from 'crypto';
import User from '#modules/users/models/user.model.js';
import { getPublicKey } from '#shared/services/keyManager.js';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const {
  NODE_ENV,
  ALLOWED_ORIGINS,
  ALLOW_BEARER_AUTH,          // "true" | "false"
  BEARER_ROUTE_WHITELIST,     // e.g. "^/api/relay/,^/api/signal/"
  INTERNAL_API_SECRET,        // opcional: exige header x-internal-api para Bearer
  JWT_ISSUER,                 // opcional: verifica "iss"
  JWT_AUDIENCE                // opcional: verifica "aud"
} = process.env;

const PUBLIC_ROUTES = new Set([
  '/api/health',
]);

// --- configuración Bearer ---
const allowBearer = String(ALLOW_BEARER_AUTH ?? 'false') === 'true';
// Nota: el whitelist real debe venir de env (Render). Mantener un default conservador.
const bearerRegexes = (BEARER_ROUTE_WHITELIST ?? '^/api/relay/,^/api/signal/')
  .split(',').map(s => s.trim()).filter(Boolean)
  .map(p => { try { return new RegExp(p); } catch { return null; } })
  .filter(Boolean);

const stripQuery = (url = '/') => {
  const i = url.indexOf('?'); return i === -1 ? url : url.slice(0, i);
};

// Evalúa contra la URL real (incluye "/api/...") y, por compat, también contra baseUrl+path
function routeAllowsBearer(req) {
  const pathOriginal = stripQuery(req.originalUrl || '/');                 // e.g. "/api/v1/relay/config"
  const pathComposed = ((req.baseUrl || '') + (req.path || '/')) || '/';   // e.g. "/v1/relay/config"
  return bearerRegexes.some(re => re.test(pathOriginal) || re.test(pathComposed));
}

function pickCorsOrigin(req) {
  const allowed = (ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const reqOrigin = req.headers.origin;
  if (reqOrigin && allowed.includes(reqOrigin)) return reqOrigin;
  return allowed[0] || '*';
}

function sendCorsError(res, req, statusCode, errorMessage, nextStep) {
  res.header('Access-Control-Allow-Origin', pickCorsOrigin(req));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Vary', 'Origin');
  return res.status(statusCode).json({ error: errorMessage, nextStep });
}

/**
 * ✅ Protege rutas privadas (cookies+CSRF para navegador; Bearer para API/SDK si está habilitado)
 */
export const protectRoute = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') return next();

    // DEV-ONLY: bypass de pruebas (asegúrate de NO definir TEST_BYPASS_WALLET en prod)
    if (process.env.TEST_BYPASS_WALLET === '1' && process.env.NODE_ENV !== 'production') {
      const headerWallet = req.header('x-test-wallet');
      if (headerWallet) {
        req.user = { wallet: headerWallet };
        req.auth = { source: 'test-bypass' };
        return next();
      }
    }

    // --- token por header o cookie ---
    const auth = req.headers['authorization'];
    let tokenFromHeader = null;
    if (auth && auth.startsWith('Bearer ')) {
      const candidate = auth.slice(7).trim();
      const internalOk = !INTERNAL_API_SECRET || req.headers['x-internal-api'] === INTERNAL_API_SECRET;
      if (allowBearer && internalOk && routeAllowsBearer(req)) {
        tokenFromHeader = candidate;
      }
    }

    const tokenFromCookie = req.cookies?.accessToken || null;
    const token = tokenFromHeader || tokenFromCookie;
    const tokenSource = tokenFromHeader ? 'header' : 'cookie';

    // públicos
    const rawPath = req.path || '/';
    const normalizedPath = rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
    const base = (req.baseUrl || '').replace(/\/+$/, '');
    const fullPath = `${base}${normalizedPath}` || '/';
    if (PUBLIC_ROUTES.has(fullPath) || PUBLIC_ROUTES.has(normalizedPath)) {
      return next();
    }

    if (!token) {
      return sendCorsError(res, req, 401, 'Authentication required', 'SIGN_IN');
    }

    // --- verifica firma RS256 con clave pública ---
    const PUBLIC_KEY = getPublicKey();
    if (!PUBLIC_KEY || typeof PUBLIC_KEY !== 'string' || PUBLIC_KEY.length < 100) {
      return sendCorsError(res, req, 500, 'Invalid public key', 'RETRY_LATER');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, PUBLIC_KEY, {
        algorithms: ['RS256'],
        clockTolerance: 5,
        ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
        ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {})
      });
    } catch {
      return sendCorsError(res, req, 403, 'Invalid authentication or CSRF token', 'REAUTHENTICATE');
    }

    const wallet = decoded.pubkey || decoded.wallet;
    if (!wallet || typeof wallet !== 'string') {
      return sendCorsError(res, req, 401, 'Invalid token payload', 'REAUTHENTICATE');
    }

    const user = await User.findOne({ wallet });
    if (!user) return sendCorsError(res, req, 404, 'USER_NOT_FOUND', 'REGISTER_WALLET');
    if (user.banned) return sendCorsError(res, req, 403, 'USER_BANNED', 'CONTACT_SUPPORT');

    // 🔒 CSRF CHECK cuando el token proviene por cookie
    if (tokenSource === 'cookie') {
      const csrfHeader = req.get('x-csrf-token') || '';
      const csrfCookie = req.cookies?.csrfToken || '';
      const csrfStored = user.csrfToken || '';
      const valid = csrfHeader && (csrfHeader === csrfStored || csrfHeader === csrfCookie);
      if (!valid) {
        return sendCorsError(res, req, 403, 'Invalid authentication or CSRF token', 'REAUTHENTICATE');
      }
    }

    // contexto
    req.user = { ...user.toObject(), wallet };
    req.auth = { source: tokenSource, exp: decoded.exp };

    return next();
  } catch (error) {
    console.error('❌ Auth Middleware Error:', error.message);
    if (req.cookies?.accessToken) res.clearCookie('accessToken', { path: '/' });
    return sendCorsError(res, req, 403, 'Invalid authentication or CSRF token', 'REAUTHENTICATE');
  }
};

/**
 * 🔄 Rota el CSRF Token
 */
export const rotateCSRFToken = (req, res, next) => {
  try {
    const newCSRFToken = crypto.randomBytes(64).toString('hex');
    res.cookie('csrfToken', newCSRFToken, {
      httpOnly: false,
      secure: NODE_ENV === 'production',
      sameSite: 'None',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.setHeader('x-csrf-token', newCSRFToken);
    return next();
  } catch {
    return res.status(500).json({ error: 'Failed to rotate CSRF token', nextStep: 'RETRY' });
  }
};
