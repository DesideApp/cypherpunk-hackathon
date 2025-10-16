// src/features/messaging/clients/fetcher.js
import { apiUrl } from "@shared/config/env.js";
import { getCSRFToken, setCSRFToken } from "@shared/utils/csrf.js";
import { readCookie, ACCESS_TOKEN_COOKIE } from "@shared/services/tokenService.js";

function readAccessToken() {
  try {
    const cookie = readCookie(ACCESS_TOKEN_COOKIE);
    if (cookie) return decodeURIComponent(cookie);
    const fallback = document.cookie.match(/(?:^|;\s*)(jwt|idToken)=([^;]+)/i);
    return fallback ? decodeURIComponent(fallback[2]) : null;
  } catch { return null; }
}

export async function fetchJson(path, init = {}) {
  const url = apiUrl(path);
  const method = (init.method || "GET").toUpperCase();
  const csrf = getCSRFToken();
  const bearer = readAccessToken();

  const hasBody = method !== "GET" && method !== "HEAD";
  const baseHeaders = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
  };

  // 👇 cabecera canónica en minúsculas (HTTP es case-insensitive, pero fijamos 1)
  const csrfHeaders = csrf ? { 'x-csrf-token': csrf } : {};

  const headers = {
    ...baseHeaders,
    ...csrfHeaders,
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    ...(init && init.headers ? init.headers : {}),
  };

  const res = await fetch(url, {
    credentials: "include",
    mode: "cors",
    ...init,
    headers,
  });

  // Rotación de CSRF por cabecera
  try {
    const newCSRF = res.headers.get("x-csrf-token") || res.headers.get("X-CSRF-Token");
    if (newCSRF) setCSRFToken(newCSRF);
  } catch {}

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();

  // Rotación de CSRF por body (si aplica)
  try {
    if (isJson && body && typeof body === "object" && body.csrfToken) {
      setCSRFToken(body.csrfToken);
    }
  } catch {}

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      try { window.dispatchEvent(new CustomEvent("auth:stale", { detail: { status: res.status, url } })); } catch {}
    }
    const err = new Error(isJson ? (body?.error || res.statusText) : res.statusText);
    err.details = { statusCode: res.status, ...(isJson ? body : {}) };
    throw err;
  }

  return body;
}

export { fetchJson as authedFetchJson };
