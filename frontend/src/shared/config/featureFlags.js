// src/shared/config/featureFlags.js
// Pequeña capa para evaluar flags en tiempo de ejecución.

import ENV from "../config/env.js";

const cache = new Map();

function getDefault(flagName) {
  switch (flagName) {
    case "WEBRTC":
      // Por defecto desactivado; el backend puede activarlo vía setFeature('WEBRTC', true)
      return false;
    case "RELAY_ONLY":
      // Fallback a política global del cliente
      return !!(ENV?.MESSAGING?.FORCE_RELAY);
    default:
      return false;
  }
}

export function isFeatureEnabled(flagName) {
  if (cache.has(flagName)) return cache.get(flagName);
  const on = getDefault(flagName);
  cache.set(flagName, on);
  return on;
}

export function setFeature(flagName, value) {
  cache.set(flagName, !!value);
}
