// src/shared/services/userDirectory.js
// Servicio centralizado de perfiles de usuario con caché + listeners
import { apiRequest } from "@shared/services/apiService.js";
import { hasSessionCookies } from "@shared/services/tokenService.js";

const PUBKEY_REGEX = /^([1-9A-HJ-NP-Za-km-z]{32,44})$/;

const DEFAULT_TTL_MS = (() => {
  try {
    const fromEnv = Number(import.meta?.env?.VITE_USER_DIR_TTL_MS);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 2 * 60 * 1000; // 2 min
  } catch {
    return 2 * 60 * 1000;
  }
})();

let TTL_MS = DEFAULT_TTL_MS;

// Estructura: Map<pubkey, { data, expiresAt, inFlight?: Promise, error?: any }>
const cache = new Map();
// Suscriptores por pubkey: Map<pubkey, Set<fn>>
const listeners = new Map();

function now() { return Date.now(); }
function isExpired(entry) { return !entry || !entry.expiresAt || entry.expiresAt <= now(); }

function normalizeProfile(raw, pk) {
  if (!raw || raw.registered === false) {
    return {
      error: false,
      registered: false,
      pubkey: pk || null,
      relationship: "none",
      blocked: false,
      nickname: null,
      avatar: null,
      social: { x: null, website: null },
    };
  }
  return {
    error: false,
    registered: true,
    pubkey: raw.pubkey || pk || null,
    relationship: raw.relationship || "none",
    blocked: !!raw.blocked,
    nickname: raw.nickname || null,
    avatar: raw.avatar || null,
    social: raw.social || { x: null, website: null },
  };
}

function notify(pubkey) {
  const subs = listeners.get(pubkey);
  if (!subs || subs.size === 0) return;
  const entry = cache.get(pubkey) || null;
  const data = entry?.data || null;
  for (const fn of subs) {
    try { fn(data); } catch {}
  }
}

export function subscribe(pubkey, fn) {
  if (!pubkey || typeof fn !== 'function') return () => {};
  const key = String(pubkey);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => {
    try { listeners.get(key)?.delete(fn); } catch {}
  };
}

export function setTTL(ms) {
  if (Number.isFinite(ms) && ms > 0) TTL_MS = Number(ms);
}

export function getUser(pubkey) {
  if (!pubkey) return null;
  const key = String(pubkey);
  const entry = cache.get(key);
  if (!entry || isExpired(entry)) return null;
  return entry.data || null;
}

export async function fetchUser(pubkey, opts = {}) {
  const { force = false } = opts || {};
  if (!pubkey || !PUBKEY_REGEX.test(String(pubkey))) {
    return normalizeProfile({ registered: false }, pubkey);
  }
  const key = String(pubkey);
  const entry = cache.get(key);

  if (!force && entry && !isExpired(entry) && entry.data) {
    return entry.data;
  }
  if (!force && entry?.inFlight) {
    return entry.inFlight;
  }

  const p = (async () => {
    const res = await apiRequest(`/api/users/${key}`, { method: "GET" });
    const normalized = normalizeProfile(res, key);
    cache.set(key, { data: normalized, expiresAt: now() + TTL_MS });
    notify(key);
    return normalized;
  })();

  cache.set(key, { ...(entry || {}), inFlight: p, expiresAt: now() + TTL_MS });
  try {
    const data = await p;
    const cur = cache.get(key) || {};
    cache.set(key, { ...cur, data, inFlight: null, expiresAt: now() + TTL_MS });
    return data;
  } catch (err) {
    const cur = cache.get(key) || {};
    cache.set(key, { ...cur, error: err, inFlight: null, expiresAt: now() + 5000 });
    notify(key);
    throw err;
  }
}

export async function fetchMany(pubkeys = [], opts = {}) {
  const set = new Set((pubkeys || []).filter(Boolean).map(String));
  if (set.size === 0) return [];

  const ready = [];
  const toFetch = [];
  for (const pk of set) {
    const e = cache.get(pk);
    if (e && !isExpired(e) && e.data && !opts.force) {
      ready.push(e.data);
    } else {
      toFetch.push(pk);
    }
  }

  if (toFetch.length === 0) return ready;

  // Intentar endpoint batch sólo si hay sesión
  if (hasSessionCookies()) {
    const res = await apiRequest('/api/v1/users/batch', {
      method: 'POST',
      body: JSON.stringify({ pubkeys: toFetch }),
    });

    if (!res?.error && Array.isArray(res?.results)) {
      const normalized = new Map();
      for (const item of res.results) {
        const pk = item?.pubkey || null;
        if (!pk) continue;
        normalized.set(pk, normalizeProfile(item, pk));
      }
      // Rellenar no registrados desde respuesta o inferidos
      const notRegs = Array.isArray(res.notRegistered) ? res.notRegistered : [];
      for (const pk of toFetch) {
        const data = normalized.get(pk) || normalizeProfile({ registered: false }, pk);
        cache.set(pk, { data, expiresAt: now() + TTL_MS });
        notify(pk);
      }
      return [
        ...ready,
        ...toFetch.map((pk) => cache.get(pk)?.data).filter(Boolean),
      ];
    }
  }

  // Fallback: individuales (comparten inFlight por clave)
  const results = await Promise.all(toFetch.map((pk) => fetchUser(pk, opts).catch(() => normalizeProfile({ registered: false }, pk))));
  return [...ready, ...results];
}

export function primeUser(pubkey, partialData) {
  if (!pubkey) return;
  const key = String(pubkey);
  const prev = cache.get(key)?.data || null;
  const merged = normalizeProfile({
    registered: true,
    pubkey: key,
    relationship: prev?.relationship || "none",
    blocked: prev?.blocked || false,
    nickname: typeof partialData?.nickname !== 'undefined' ? partialData.nickname : (prev?.nickname ?? null),
    avatar: typeof partialData?.avatar !== 'undefined' ? partialData.avatar : (prev?.avatar ?? null),
    social: typeof partialData?.social !== 'undefined' ? partialData.social : (prev?.social ?? { x: null, website: null }),
  }, key);
  cache.set(key, { data: merged, expiresAt: now() + TTL_MS });
  notify(key);
}

export function invalidateUser(pubkey) {
  if (!pubkey) return;
  const key = String(pubkey);
  cache.delete(key);
  notify(key);
}

export function clearAll() {
  cache.clear();
  listeners.clear();
}

export default {
  setTTL,
  getUser,
  fetchUser,
  fetchMany,
  primeUser,
  invalidateUser,
  subscribe,
  clearAll,
};

