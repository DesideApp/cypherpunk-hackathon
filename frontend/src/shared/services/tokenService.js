import { createDebugLogger } from "@shared/utils/debug.js";
import { STORAGE_NS, COOKIE_NAMES } from "@shared/config/env.js";

let isRefreshing = false;
let refreshPromise = null;

export const CSRF_STORAGE_KEY = `${STORAGE_NS}:csrfToken`;
export const WALLET_SIGNATURE_KEY = `${STORAGE_NS}:walletSignature`;
export const ACCESS_TOKEN_COOKIE = COOKIE_NAMES.accessToken;
export const REFRESH_TOKEN_COOKIE = COOKIE_NAMES.refreshToken;
export const CSRF_COOKIE_NAME = COOKIE_NAMES.csrfToken;

const EVENT_DEBOUNCE_MS = 1500;
let lastExpiredEmit = 0;

const DEBUG = createDebugLogger("Token", { envKey: "VITE_DEBUG_TOKEN_LOGS" });

export function readCookie(name) {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function storeCSRFToken(token) {
  if (!token) return;
  try {
    const existing = localStorage.getItem(CSRF_STORAGE_KEY);
    if (existing === token) {
      DEBUG("storeCSRFToken: token unchanged");
      return;
    }
    localStorage.setItem(CSRF_STORAGE_KEY, token);
    try { localStorage.removeItem('csrfToken'); } catch {}
    DEBUG("storeCSRFToken:", token);
  } catch (err) {
    console.warn("⚠️ No se pudo guardar CSRF Token:", err.message);
  }
}

export function getStoredCSRFToken() {
  const fromCookie = readCookie(CSRF_COOKIE_NAME);
  if (fromCookie) {
    storeCSRFToken(fromCookie);
    DEBUG("getStoredCSRFToken(cookie):", fromCookie);
    return fromCookie;
  }
  const fromLS = localStorage.getItem(CSRF_STORAGE_KEY) || null;
  if (!fromLS) {
    try {
      const legacy = localStorage.getItem('csrfToken');
      if (legacy) {
        storeCSRFToken(legacy);
        return legacy;
      }
    } catch {}
  }
  DEBUG("getStoredCSRFToken(localStorage):", fromLS);
  return fromLS;
}

// ===== Firma de wallet (para backups automáticos) =====
export function storeWalletSignature(signatureBase58) {
  try {
    if (!signatureBase58) return;
    localStorage.setItem(WALLET_SIGNATURE_KEY, signatureBase58);
    DEBUG("storeWalletSignature: set");
  } catch (err) {
    console.warn("⚠️ No se pudo guardar Wallet Signature:", err?.message);
  }
}

export function getWalletSignature() {
  try {
    const v = localStorage.getItem(WALLET_SIGNATURE_KEY) || null;
    if (v) DEBUG("getWalletSignature: present");
    return v;
  } catch {
    return null;
  }
}

export function clearWalletSignature() {
  try { localStorage.removeItem(WALLET_SIGNATURE_KEY); } catch {}
}

/** ✔️ Indica si REALMENTE había sesión previa en el navegador. */
export function hasSessionTokens() {
  try {
    const hasCsrf = !!(localStorage.getItem(CSRF_STORAGE_KEY) || readCookie(CSRF_COOKIE_NAME));
    const hasAccess = !!readCookie(ACCESS_TOKEN_COOKIE);
    const hasRefresh = !!readCookie(REFRESH_TOKEN_COOKIE);
    return hasCsrf || hasAccess || hasRefresh;
  } catch {
    return false;
  }
}

/** ✔️ Indica si hay cookies de sesión activas (accessToken o refreshToken). */
export function hasSessionCookies() {
  try {
    return !!(readCookie(ACCESS_TOKEN_COOKIE) || readCookie(REFRESH_TOKEN_COOKIE));
  } catch {
    return false;
  }
}

/** ✔️ Emite 'sessionExpired' con fusible antiruido. */
export function emitSessionExpired(reason = "expired") {
  const now = Date.now();
  if (now - lastExpiredEmit < EVENT_DEBOUNCE_MS) return;
  lastExpiredEmit = now;
  try {
    window.dispatchEvent(new CustomEvent("sessionExpired", { detail: { reason } }));
  } catch {}
}

export async function refreshToken() {
  if (isRefreshing) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const url = `${import.meta.env.VITE_BACKEND_URL}/api/auth/refresh`;
      DEBUG("→ POST refresh:", url);

      const response = await fetch(url, { method: "POST", credentials: "include" });

      if (!response.ok) {
        console.warn("[Token] ← refresh NOT OK:", response.status);
        // Sólo avisamos de expiración si había sesión previa
        if (hasSessionTokens()) emitSessionExpired("refresh_failed");
        return false;
      }

      const csrfFromHeader = response.headers.get("x-csrf-token");
      if (csrfFromHeader) {
        DEBUG("CSRF(header):", csrfFromHeader);
        storeCSRFToken(csrfFromHeader);
      }

      try {
        const data = await response.clone().json();
        if (data?.csrfToken) {
          DEBUG("CSRF(body):", data.csrfToken);
          storeCSRFToken(data.csrfToken);
        }
      } catch (_) {}

      // Recalentamos cache local
      getStoredCSRFToken();
      window.dispatchEvent(new Event("sessionRefreshed"));
      DEBUG("refresh OK → sessionRefreshed");
      return true;
    } catch (error) {
      console.error("❌ refreshToken error:", error.message);
      if (hasSessionTokens()) emitSessionExpired("refresh_error");
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function clearSession(reason = "manual") {
  try {
    localStorage.removeItem(CSRF_STORAGE_KEY);
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
    try { localStorage.removeItem('csrfToken'); sessionStorage.removeItem('csrfToken'); } catch {}
    const cookieNames = [
      ACCESS_TOKEN_COOKIE,
      REFRESH_TOKEN_COOKIE,
      CSRF_COOKIE_NAME,
      'accessToken',
      'refreshToken',
      'csrfToken',
    ];
    cookieNames.forEach((name) => {
      try {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      } catch {}
    });
    DEBUG("clearSession:", reason);
  } catch (error) {
    console.error("❌ clearSession error:", error.message);
  }
  // 👇 intencionadamente NO emitimos eventos aquí
}
