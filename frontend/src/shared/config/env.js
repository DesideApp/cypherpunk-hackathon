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

// --- bases (con alias compatibles) ---
const API_BASE_URL = trimRightSlash(
  readFirst(['VITE_API_BASE_URL', 'VITE_BACKEND_URL'], 'http://localhost:10000')
);

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
let rtcServers = [{ urls: 'stun:stun.l.google.com:19302' }];
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
  FORCE_RELAY:         toBool(readEnv('VITE_FORCE_RELAY', 'false'), false),
  USE_WEBRTC_FOR_TEXT: toBool(readEnv('VITE_USE_WEBRTC_FOR_TEXT', 'true'), true),
  TEXT_MAX_BYTES:      toNum(readEnv('VITE_TEXT_MAX_BYTES',   `${32 * 1024}`),        32 * 1024),
  // TTL para considerar a un peer "online" basado en última actividad/presencia (ms)
  PRESENCE_TTL_MS:     toNum(readEnv('VITE_PRESENCE_TTL_MS', `${45 * 1000}`), 45 * 1000),
  // Timeout para apertura de RTC DataChannel antes de fallback a Relay (↑ 10s para depuración/fiabilidad)
  RTC_OPEN_TIMEOUT_MS: toNum(readEnv('VITE_RTC_OPEN_TIMEOUT_MS', '10000'), 10000),
  // Intervalo de heartbeat para presencia por WS
  HEARTBEAT_INTERVAL_MS: toNum(readEnv('VITE_HEARTBEAT_INTERVAL_MS', `${25 * 1000}`), 25 * 1000),
};

// --- helpers públicos ---
export function apiUrl(path) {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Named exports (útiles si quieres importar sin ENV)
export { API_BASE_URL, WS_URL, ENDPOINTS, RTC_CONFIG, MESSAGING };

// Default aggregate
export const ENV = { API_BASE_URL, WS_URL, ENDPOINTS, RTC_CONFIG, MESSAGING };
export default ENV;

// Debug visible SOLO en dev
if (readEnv('VITE_ENV', '') === 'development') {
  console.debug('[ENV]', { API_BASE_URL, WS_URL, ENDPOINTS, MESSAGING });
}
