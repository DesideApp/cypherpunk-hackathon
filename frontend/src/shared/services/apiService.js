// src/shared/services/apiService.js
import {
  storeCSRFToken,
  getStoredCSRFToken,
  hasSessionTokens,
  emitSessionExpired,
  getWalletSignature,
} from "./tokenService.js";
import { apiUrl } from "@shared/config/env.js";

const cache = new Map();
const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 min

function normalizeEndpoint(ep) {
  return `/${String(ep || "").replace(/^\//, "")}`;
}

function readAccessToken() {
  try {
    const m = document.cookie.match(/(?:^|;\s*)(accessToken|jwt|idToken)=([^;]+)/i);
    return m ? decodeURIComponent(m[2]) : null;
  } catch { return null; }
}

export async function apiRequest(endpoint, options = {}, useCache = false) {
  if (!endpoint) throw new Error("❌ API Request sin endpoint definido.");

  const path = normalizeEndpoint(endpoint);
  const requestUrl = apiUrl(path);
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = `${method}:${requestUrl}:${JSON.stringify(options.body || null)}`;

  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp <= CACHE_EXPIRATION) {
      console.debug("[API] cache hit:", method, requestUrl);
      return cached.data;
    }
  }

  try {
    const csrfToken = getStoredCSRFToken();
    const bearer = readAccessToken();
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      // ✅ Enviar SOLO un header CSRF
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      // ✅ Firma de wallet (si está disponible) para habilitar backups automáticos en backend
      ...(getWalletSignature() ? { "X-Wallet-Signature": getWalletSignature() } : {}),
        // ✅ Autorización si el token es accesible
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(options.headers || {}),
    };

    console.debug("[API] →", method, requestUrl, { hasCSRF: !!csrfToken });

    const response = await fetch(requestUrl, {
      ...options,
      method,
      credentials: "include",
      headers,
    });

    // 204 sin body
    if (response.status === 204) return {};

    // CSRF rotatorio (cabecera)
    const newCSRF =
      response.headers.get("x-csrf-token") ||
      response.headers.get("X-CSRF-Token");
    if (newCSRF) {
      console.debug("[API] CSRF(header):", newCSRF);
      storeCSRFToken(newCSRF);
    }

    // Manejo de no-OK
    if (!response.ok) {
      // ✅ Trata 401 **y 403** en /auth/status como "no autenticado" (evita bucles y doble firma)
      if ((response.status === 401 || response.status === 403) && path === "/api/v1/auth/status") {
        console.debug("[API] ←", method, requestUrl, `${response.status} (status => not authenticated)`);
        return { isAuthenticated: false };
      }

      // Otras rutas: si había sesión, avisamos de expiración
      if (response.status === 401 || response.status === 419 || response.status === 440) {
        if (hasSessionTokens()) emitSessionExpired(String(response.status));
      }

      let errorData = {};
      try {
        errorData = await response.json();
      } catch {}
      console.warn("[API] ←", method, requestUrl, response.status, errorData);

      return {
        error: true,
        statusCode: response.status,
        message: errorData.message || response.statusText,
        errorCode: errorData.error || errorData.code || null,
      };
    }

    const data = await response.json().catch(() => ({}));

    // CSRF en body (por compat)
    if (data?.csrfToken) {
      console.debug("[API] CSRF(body):", data.csrfToken);
      storeCSRFToken(data.csrfToken);
    }

    if (useCache) {
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    console.debug("[API] ←", method, requestUrl, "OK");
    return data;
  } catch (err) {
    console.error("[API] ❌", method, requestUrl, err?.message);
    // Errores de red NO implican expiración
    return { error: true, message: err?.message || "Error en la API" };
  }
}

/* -------------------- helpers de alto nivel -------------------- */

export async function authenticateWithServer(pubkey, signature, message) {
  return apiRequest("/api/v1/auth/auth", {
    method: "POST",
    body: JSON.stringify({ pubkey, signature, message }),
  });
}

export async function checkAuthStatus() {
  const res = await apiRequest("/api/v1/auth/status", { method: "GET" });
  // Siempre devolvemos el shape uniforme
  return { isAuthenticated: !!res?.isAuthenticated };
}

export async function checkWalletRegistered(pubkey) {
  if (!pubkey) return { registered: false, error: "No public key provided." };
  return apiRequest(`/api/v1/contacts/check/${pubkey}`, { method: "GET" });
}

export async function logout() {
  return apiRequest("/api/v1/auth/revoke", { method: "POST" });
}

export async function getNonceFromServer() {
  return apiRequest("/api/v1/auth/nonce", { method: "GET" });
}
