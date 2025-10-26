// src/modules/auth/controllers/auth.controller.js
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '#modules/users/models/user.model.js';
import Notification from '#modules/users/models/notification.model.js';
import { verifySignature } from '#utils/solanaUtils.js';
import { getPrivateKey, getPublicKey } from '#shared/services/keyManager.js';
import { COOKIE_NAMES } from '#config/cookies.js';

const {
  REFRESH_SECRET,
  NODE_ENV,
  JWT_ISSUER,
  JWT_AUDIENCE,
  EXPECTED_DOMAIN,
  COOKIE_DOMAIN,
} = process.env;
const IS_PRODUCTION = NODE_ENV === 'production';
const TRIMMED_COOKIE_DOMAIN = COOKIE_DOMAIN?.trim();
const normalizeBoolean = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return Boolean(value);
};

const VALID_SAMESITE = new Set(['lax', 'none', 'strict']);
const resolveSameSite = () => {
  const fromEnv = process.env.COOKIE_SAMESITE?.trim().toLowerCase();
  if (fromEnv && VALID_SAMESITE.has(fromEnv)) return fromEnv;
  return IS_PRODUCTION ? 'none' : 'lax';
};

const COOKIE_SAMESITE = resolveSameSite();
const COOKIE_SECURE = normalizeBoolean(process.env.COOKIE_SECURE, IS_PRODUCTION);

if (!REFRESH_SECRET) {
  throw new Error('❌ REFRESH_SECRET no está definido en el entorno');
}

const nonceStore = new Map();
const generateCSRFToken = () => crypto.randomBytes(64).toString('hex');
const purgeNonces = (maxAgeMs = 2 * 60 * 1000) => {
  const now = Date.now();
  for (const [nonce, ts] of nonceStore) {
    if (now - ts > maxAgeMs) nonceStore.delete(nonce);
  }
};

/**
 * Construye de forma segura las opciones comunes de claims (issuer/audience).
 */
const buildClaims = () => {
  const opts = {};
  if (typeof JWT_ISSUER === 'string' && JWT_ISSUER.trim() && JWT_ISSUER !== 'undefined' && JWT_ISSUER !== 'null') {
    opts.issuer = JWT_ISSUER;
  }
  if (typeof JWT_AUDIENCE === 'string' && JWT_AUDIENCE.trim() && JWT_AUDIENCE !== 'undefined' && JWT_AUDIENCE !== 'null') {
    opts.audience = JWT_AUDIENCE;
  }
  return opts;
};

const createAccessToken = (pubkey) => {
  const privateKey = getPrivateKey();
  if (!privateKey || typeof privateKey !== 'string' || privateKey.length < 100) {
    throw new Error('❌ Clave privada inválida o vacía');
  }
  const opts = { algorithm: 'RS256', expiresIn: '15m', ...buildClaims() };
  return jwt.sign({ pubkey }, privateKey, opts);
};

const buildCookieOptions = (overrides = {}) => {
  const options = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: '/',
    ...overrides,
  };
  if (TRIMMED_COOKIE_DOMAIN) {
    options.domain = TRIMMED_COOKIE_DOMAIN;
  }
  return options;
};

const buildClearCookieOptions = () => {
  const options = { path: '/' };
  if (TRIMMED_COOKIE_DOMAIN) {
    options.domain = TRIMMED_COOKIE_DOMAIN;
  }
  return options;
};

const {
  accessToken: ACCESS_COOKIE_NAME,
  refreshToken: REFRESH_COOKIE_NAME,
  csrfToken: CSRF_COOKIE_NAME,
} = COOKIE_NAMES;

const LEGACY_COOKIE_NAMES = ['accessToken', 'refreshToken', 'csrfToken'];
const ALL_COOKIE_NAMES = [ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, CSRF_COOKIE_NAME, ...LEGACY_COOKIE_NAMES];

const clearAllCookies = (res, opts) => {
  for (const name of ALL_COOKIE_NAMES) {
    try { res.clearCookie(name, opts); } catch {}
  }
};

export const generateNonce = (req, res) => {
  purgeNonces();
  const nonce = crypto.randomBytes(16).toString('hex');
  nonceStore.set(nonce, Date.now());
  res.status(200).json({ nonce });
};

export const loginUser = async (req, res) => {
  const { pubkey, signature, message } = req.body;
  try {
    if (!pubkey || !signature || !message) {
      return res.status(400).json({ error: 'MISSING_FIELDS', nextStep: 'SIGN_WALLET' });
    }

    // Validación de nonce (2 minutos máx desde generateNonce)
    const nonceMatch = typeof message === 'string' ? message.match(/Nonce:\s*(\w+)/) : null;
    const nonce = nonceMatch?.[1];
    if (!nonce || !nonceStore.has(nonce)) {
      return res.status(400).json({ error: 'INVALID_NONCE', nextStep: 'RETRY_SIGNING' });
    }
    const age = Date.now() - nonceStore.get(nonce);
    nonceStore.delete(nonce);
    if (age > 60_000) {
      return res.status(400).json({ error: 'EXPIRED_NONCE', nextStep: 'RETRY_SIGNING' });
    }

    // Validación de dominio (si EXPECTED_DOMAIN está definido)
    if (EXPECTED_DOMAIN) {
      const expected = EXPECTED_DOMAIN.split(',').map(s => s.trim().replace(/\/$/, ''));
      const domainMatch =
        (typeof message === 'string' && message.match(/^Domain:\s*(\S+)/m)) ||
        (typeof message === 'string' && message.match(/origin=(\S+)/));
      const domain = (domainMatch?.[1] || '').trim().replace(/\/$/, '');
      if (!domain || !expected.includes(domain)) {
        return res.status(400).json({ error: 'INVALID_DOMAIN', nextStep: 'RETRY_SIGNING' });
      }
    }

    // Verificación de firma
    if (!verifySignature(message, signature, pubkey)) {
      return res.status(401).json({ error: 'INVALID_SIGNATURE', nextStep: 'RETRY_SIGNING' });
    }

    // Sanea cuentas con contador negativo por eventuales carreras previas.
    await User.updateOne(
      { wallet: pubkey, relayUsedBytes: { $lt: 0 } },
      { $set: { relayUsedBytes: 0 } },
      { runValidators: false }
    ).catch(() => {});

    const user = await User.findOneAndUpdate(
      { wallet: pubkey },
      { $setOnInsert: { registeredAt: new Date() }, $set: { lastLogin: new Date() }, $inc: { loginCount: 1 } },
      { new: true, upsert: true, runValidators: true }
    );

    if (user?.banned || user?.isBanned) {
      return res.status(403).json({ error: 'ACCOUNT_BANNED', nextStep: 'CONTACT_SUPPORT' });
    }

    const accessToken = createAccessToken(pubkey);
    const refreshSignOpts = { expiresIn: '7d', ...buildClaims() };
    const refreshToken = jwt.sign({ pubkey }, REFRESH_SECRET, refreshSignOpts);
    const csrfToken = generateCSRFToken();
    user.csrfToken = csrfToken;
    await user.save();

    // Log de conexión web3

    const notifications = await Notification.find({ pubkey, read: false });

    const cookieOptions = buildCookieOptions();

    return res
      .cookie(ACCESS_COOKIE_NAME, accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
      .cookie(REFRESH_COOKIE_NAME, refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .cookie(CSRF_COOKIE_NAME, csrfToken, { ...cookieOptions, httpOnly: false })
      .header('x-csrf-token', csrfToken)
      .status(200)
      .json({
        message: '✅ Autenticación exitosa.',
        nextStep: 'ACCESS_GRANTED',
        csrfToken,
        user: {
          wallet: pubkey,
        },
        notifications,
      });
  } catch (error) {
    console.error('❌ Auth Error:', error);
    return res.status(500).json({ error: 'Authentication failed', nextStep: 'RETRY_LATER' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshTokenCookie = req.cookies[REFRESH_COOKIE_NAME];
    if (!refreshTokenCookie) {
      return res.status(403).json({ error: 'No refresh token provided', nextStep: 'REAUTHENTICATE' });
    }

    const decoded = jwt.verify(refreshTokenCookie, REFRESH_SECRET, buildClaims());
    const user = await User.findOne({ wallet: decoded.pubkey });
    if (!user) {
      return res.status(403).json({ error: 'Invalid refresh token', nextStep: 'REAUTHENTICATE' });
    }

    if (user.banned || user.isBanned) {
      const clearOptions = buildClearCookieOptions();
      clearAllCookies(res, clearOptions);
      return res.status(403).json({ error: 'ACCOUNT_BANNED', nextStep: 'CONTACT_SUPPORT' });
    }

    const newAccessToken = createAccessToken(decoded.pubkey);
    const newCSRFToken = generateCSRFToken();
    user.csrfToken = newCSRFToken;
    await user.save();

    const cookieOptions = buildCookieOptions();

    return res
      .cookie(ACCESS_COOKIE_NAME, newAccessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 })
      .cookie(CSRF_COOKIE_NAME, newCSRFToken, { ...cookieOptions, httpOnly: false, maxAge: 15 * 60 * 1000 })
      .header('x-csrf-token', newCSRFToken)
      .status(200)
      .json({ message: '✅ Access Token & CSRF refreshed', nextStep: 'ACCESS_GRANTED', csrfToken: newCSRFToken });
  } catch (error) {
    console.error('❌ Error al renovar Access Token:', error);
    return res.status(403).json({ error: 'Failed to refresh token', nextStep: 'REAUTHENTICATE' });
  }
};

export const checkAuthStatus = async (req, res) => {
  try {
    const token = req.cookies[ACCESS_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ isAuthenticated: false, nextStep: 'SIGN_IN' });
    }

    const publicKey = getPublicKey();
    if (!publicKey) {
      return res.status(500).json({ isAuthenticated: false, nextStep: 'RETRY_LATER' });
    }

    const verifyOpts = { algorithms: ['RS256'], ...buildClaims() };
    const decoded = jwt.verify(token, publicKey, verifyOpts);

    const user = await User.findOne({ wallet: decoded.pubkey });
    if (!user) {
      return res.status(404).json({ isAuthenticated: false, nextStep: 'REGISTER_WALLET' });
    }

    if (user.banned || user.isBanned) {
      return res.status(403).json({ isAuthenticated: false, nextStep: 'CONTACT_SUPPORT' });
    }

    const role = (user.role || '').toString().trim().toLowerCase() || 'user';
    const walletLower = decoded.pubkey.toLowerCase();
    const adminList = (process.env.ADMIN_WALLETS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = role === 'admin' || user.isAdmin === true || adminList.includes(walletLower);

    return res.status(200).json({
      isAuthenticated: true,
      wallet: decoded.pubkey,
      role,
      isAdmin,
      expiresIn: 900000,
      nextStep: 'ACCESS_GRANTED',
      csrfToken: user.csrfToken || null,
    });
  } catch (error) {
    console.error('❌ Error en /status:', error);
    return res.status(403).json({ isAuthenticated: false, nextStep: 'REAUTHENTICATE' });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const clearOptions = buildClearCookieOptions();
    clearAllCookies(res, clearOptions);
    return res.status(200).json({ message: '✅ Sesión cerrada correctamente.', nextStep: 'LOGOUT_SUCCESS' });
  } catch (error) {
    console.error('❌ Error al cerrar sesión:', error);
    return res.status(500).json({ error: 'Logout failed', nextStep: 'RETRY_LATER' });
  }
};
