// src/shared/config/env.js 

// --- helpers ---
function readEnv(key, fallback) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
      const v = import.meta.env[key];
      if (v !== undefined) return v;
    }
  } catch (_) {}
  if (typeof window !== 'undefined' && window.__ENV__ && key in window.__ENV__) {
    const v = window.__ENV__[key];
    if (v !== undefined) return v;
  }
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    const v = process.env[key];
    if (v !== undefined) return v;
  }
  return fallback;
}

function readFirst(keys, fallback) {
  for (const k of keys) {
    const v = readEnv(k, undefined);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
}

function trimRightSlash(u) {
  if (!u) return u;
  return String(u).replace(/\/+$/, '');
}
function toBool(v, def = false) {
  if (v === undefined || v === null) return def;
  return String(v).toLowerCase() === 'true';
}
function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const IS_DEMO = toBool(readEnv('VITE_DEMO_MODE', ''), false);
const STORAGE_NS = IS_DEMO ? 'deside_demo' : 'deside_dev';
const CACHE_NS = IS_DEMO ? 'demo' : 'dev';
const COOKIE_SUFFIX = IS_DEMO ? '_demo' : '';
const COOKIE_NAMES = {
  accessToken: `accessToken${COOKIE_SUFFIX}`,
  refreshToken: `refreshToken${COOKIE_SUFFIX}`,
  csrfToken: `csrfToken${COOKIE_SUFFIX}`,
};

const E2E_SHARED_KEY_BASE64 = readEnv('VITE_E2E_SHARED_KEY_BASE64', '');
const SOLANA_CHAIN = readEnv('VITE_SOLANA_CHAIN', IS_DEMO ? 'devnet' : 'mainnet-beta');

// --- bases (con alias compatibles) ---
const API_BASE_URL = trimRightSlash(
  readFirst(['VITE_API_BASE_URL', 'VITE_BACKEND_URL'], 'http://localhost:3001')
);

const DIALECT_API_BASE_URL = trimRightSlash(
  readEnv('VITE_DIALECT_API_BASE_URL', 'https://api.dial.to/v1')
);
const DIALECT_CLIENT_KEY = readEnv('VITE_BLINK_CLIENT_KEY', '');

// Socket.IO puede recibir base HTTP/HTTPS; internamente usará /socket.io
const WS_URL = trimRightSlash(
  readFirst(['VITE_WS_URL', 'VITE_WEBSOCKET_URL'], API_BASE_URL)
);

// --- endpoints centralizados (con overrides por ENV donde aplica) ---
// Relay (por convención backend actual: /api/v1/relay/*)
const RELAY_SEND_PATH   = readEnv('VITE_RELAY_ENQUEUE_PATH', '/api/v1/relay/enqueue');
const RELAY_FETCH_PATH  = readEnv('VITE_RELAY_FETCH_PATH',  '/api/v1/relay/fetch');
const RELAY_ACK_PATH    = readEnv('VITE_RELAY_ACK_PATH',    '/api/v1/relay/ack');
const RELAY_CONFIG_PATH = readEnv('VITE_RELAY_CONFIG_PATH', '/api/v1/relay/config');
const RELAY_USAGE_PATH  = readEnv('VITE_RELAY_USAGE_PATH',  '/api/v1/relay/usage');
const RELAY_PURGE_PATH  = readEnv('VITE_RELAY_PURGE_PATH',  '/api/v1/relay/purge');

const ENDPOINTS = {
  SIGNAL: {
    // Backend: /api/v1/signal (oferta/answer/ice por body)
    OFFER:  '/api/v1/signal',
    ANSWER: '/api/v1/signal',
    ICE:    '/api/v1/signal',
  },
  RELAY: {
    // Envío/recepción (BACKEND real)
    SEND:  RELAY_SEND_PATH,
    PULL:  RELAY_FETCH_PATH,
    ACK:   RELAY_ACK_PATH,

    // Info de relay (opcionales; existen en tu router)
    CONFIG: RELAY_CONFIG_PATH,
    USAGE:  RELAY_USAGE_PATH,
    PURGE:  RELAY_PURGE_PATH,

  },

  // TURN efímero servido por backend
  RTC_ICE: readEnv('VITE_RTC_ICE_PATH', '/api/v1/rtc/ice'),
  
  // Feature flags del usuario (requiere barra final según backend)
  USER_FLAGS: readEnv('VITE_USER_FLAGS_PATH', '/api/v1/flags/me/'),
};

// --- WebRTC (STUN/TURN por JSON en env si lo necesitas) ---
let rtcServers = IS_DEMO
  ? [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }]
  : [{ urls: 'stun:stun.l.google.com:19302' }];
try {
  const raw = readEnv('VITE_TURN_JSON', '');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) || (parsed && typeof parsed === 'object')) {
      rtcServers = parsed;
    }
  }
} catch (_) {}
const RTC_CONFIG = { iceServers: rtcServers };

// --- políticas de cliente/toggles ---
const MESSAGING = {
  FORCE_RELAY:         toBool(readEnv('VITE_FORCE_RELAY', IS_DEMO ? 'true' : 'false'), IS_DEMO),
  USE_WEBRTC_FOR_TEXT: toBool(readEnv('VITE_USE_WEBRTC_FOR_TEXT', IS_DEMO ? 'false' : 'true'), !IS_DEMO),
  TEXT_MAX_BYTES:      toNum(readEnv('VITE_TEXT_MAX_BYTES',   `${32 * 1024}`),        32 * 1024),
  // TTL para considerar a un peer "online" basado en última actividad/presencia (ms)
  PRESENCE_TTL_MS:     toNum(readEnv('VITE_PRESENCE_TTL_MS', `${45 * 1000}`), 45 * 1000),
  // Timeout para apertura de RTC DataChannel antes de fallback a Relay (↑ 10s para depuración/fiabilidad)
  RTC_OPEN_TIMEOUT_MS: toNum(readEnv('VITE_RTC_OPEN_TIMEOUT_MS', '10000'), 10000),
  // Intervalo de heartbeat para presencia por WS
  HEARTBEAT_INTERVAL_MS: toNum(readEnv('VITE_HEARTBEAT_INTERVAL_MS', `${25 * 1000}`), 25 * 1000),
};

// --- feature flags de la app (expuestos para UI/flows) ---
const FEATURES = {
  AGREEMENT_VERIFY: toBool(readEnv('VITE_FEATURE_AGREEMENT_VERIFY', 'false'), false),
  AGREEMENT_SETTLEMENT: toBool(readEnv('VITE_FEATURE_AGREEMENT_SETTLEMENT', 'false'), false),
  PAYMENT_INLINE_EXEC: toBool(readEnv('VITE_PAYMENT_INLINE_EXEC', 'true'), true),
};

const MOCKS = {
  BLINK_BUY: toBool(readEnv('VITE_ENABLE_BLINK_BUY_MOCK', 'false'), false),
};

const DIALECT = {
  API_BASE_URL: DIALECT_API_BASE_URL,
  CLIENT_KEY: DIALECT_CLIENT_KEY,
};

const SOLANA = {
  CHAIN: SOLANA_CHAIN,
};

// --- helpers públicos ---
export function apiUrl(path) {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Named exports (útiles si quieres importar sin ENV)
export { API_BASE_URL, WS_URL, ENDPOINTS, RTC_CONFIG, MESSAGING, IS_DEMO, STORAGE_NS, CACHE_NS, COOKIE_NAMES, E2E_SHARED_KEY_BASE64, FEATURES, DIALECT, SOLANA, MOCKS };

// Default aggregate
export const ENV = { API_BASE_URL, WS_URL, ENDPOINTS, RTC_CONFIG, MESSAGING, IS_DEMO, STORAGE_NS, CACHE_NS, COOKIE_NAMES, E2E_SHARED_KEY_BASE64, FEATURES, DIALECT, SOLANA, MOCKS };
export default ENV;

// Debug visible SOLO en dev
if (readEnv('VITE_ENV', '') === 'development') {
  console.debug('[ENV]', { API_BASE_URL, WS_URL, ENDPOINTS, MESSAGING });
}
