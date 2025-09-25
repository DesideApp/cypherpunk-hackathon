import { createDebugLogger } from "@shared/utils/debug.js";

let isRefreshing = false;
let refreshPromise = null;

const CSRF_KEY = "csrfToken";
const WALLET_SIG_KEY = "walletSignature";
const EVENT_DEBOUNCE_MS = 1500;
let lastExpiredEmit = 0;

const DEBUG = createDebugLogger("Token", { envKey: "VITE_DEBUG_TOKEN_LOGS" });

export function storeCSRFToken(token) {
  if (!token) return;
  try {
    const existing = localStorage.getItem(CSRF_KEY);
    if (existing === token) {
      DEBUG("storeCSRFToken: token unchanged");
      return;
    }
    localStorage.setItem(CSRF_KEY, token);
    DEBUG("storeCSRFToken:", token);
  } catch (err) {
    console.warn("⚠️ No se pudo guardar CSRF Token:", err.message);
  }
}

export function getStoredCSRFToken() {
  const fromCookie = document.cookie.match(/csrfToken=([^;]+)/)?.[1];
  if (fromCookie) {
    storeCSRFToken(fromCookie);
    DEBUG("getStoredCSRFToken(cookie):", fromCookie);
    return fromCookie;
  }
  const fromLS = localStorage.getItem(CSRF_KEY) || null;
  DEBUG("getStoredCSRFToken(localStorage):", fromLS);
  return fromLS;
}

// ===== Firma de wallet (para backups automáticos) =====
export function storeWalletSignature(signatureBase58) {
  try {
    if (!signatureBase58) return;
    localStorage.setItem(WALLET_SIG_KEY, signatureBase58);
    DEBUG("storeWalletSignature: set");
  } catch (err) {
    console.warn("⚠️ No se pudo guardar Wallet Signature:", err?.message);
  }
}

export function getWalletSignature() {
  try {
    const v = localStorage.getItem(WALLET_SIG_KEY) || null;
    if (v) DEBUG("getWalletSignature: present");
    return v;
  } catch {
    return null;
  }
}

export function clearWalletSignature() {
  try { localStorage.removeItem(WALLET_SIG_KEY); } catch {}
}

/** ✔️ Indica si REALMENTE había sesión previa en el navegador. */
export function hasSessionTokens() {
  try {
    const hasCsrf = !!(localStorage.getItem(CSRF_KEY) || document.cookie.match(/csrfToken=([^;]+)/));
    const hasAccess = document.cookie.includes("accessToken=");
    const hasRefresh = document.cookie.includes("refreshToken=");
    return hasCsrf || hasAccess || hasRefresh;
  } catch {
    return false;
  }
}

/** ✔️ Indica si hay cookies de sesión activas (accessToken o refreshToken). */
export function hasSessionCookies() {
  try {
    const c = document.cookie || '';
    return /(?:^|;\s*)(accessToken|refreshToken)=/.test(c);
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
    localStorage.removeItem(CSRF_KEY);
    sessionStorage.removeItem(CSRF_KEY);
    document.cookie = "csrfToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    DEBUG("clearSession:", reason);
  } catch (error) {
    console.error("❌ clearSession error:", error.message);
  }
  // 👇 intencionadamente NO emitimos eventos aquí
}
