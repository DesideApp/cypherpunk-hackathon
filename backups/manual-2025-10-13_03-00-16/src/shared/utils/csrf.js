// src/shared/utils/csrf.js
// Utilidad centralizada para manejo de tokens CSRF (memoria + localStorage)

import { CSRF_STORAGE_KEY, getStoredCSRFToken, storeCSRFToken } from "@shared/services/tokenService.js";

let _csrf = null;

// Mantener sincronizado el caché en memoria si otra pestaña modifica el valor
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    if (e.key === CSRF_STORAGE_KEY) {
      _csrf = e.newValue || null;
    }
  });
}

export function setCSRFToken(token) {
  _csrf = token || null;
  try {
    if (token) storeCSRFToken(token);
    else localStorage.removeItem(CSRF_STORAGE_KEY);
  } catch {}
}

// Siempre intenta leer el último valor persistido para evitar staleness.
// Si localStorage falla (modo privado estricto, etc.), usa el caché en memoria.
export function getCSRFToken() {
  try {
    const v = getStoredCSRFToken();
    if (v) { _csrf = v; return v; }
  } catch {}
  return _csrf;
}

// Compat: alias histórico
export function readCSRF() {
  return getCSRFToken();
}

export function csrfHeaders() {
  const t = getCSRFToken();
  return t ? { 'x-csrf-token': t } : {};
}
