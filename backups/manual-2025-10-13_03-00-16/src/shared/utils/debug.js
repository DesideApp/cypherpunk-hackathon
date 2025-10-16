// src/shared/utils/debug.js
// Lightweight namespace-aware debug logger with runtime/env toggles.

function readEnvFlag(key) {
  if (!key) return undefined;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
      const val = import.meta.env[key];
      if (val !== undefined) return val;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.__ENV__ && key in window.__ENV__) {
      const val = window.__ENV__[key];
      if (val !== undefined) return val;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && key in process.env) {
      const val = process.env[key];
      if (val !== undefined) return val;
    }
  } catch {}
  return undefined;
}

function toBool(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

function globalFlag(namespace) {
  try {
    if (typeof window === 'undefined') return undefined;
    const debug = window.__DEBUG__;
    if (!debug) return undefined;
    if (debug === true) return true;
    if (typeof debug === 'object') {
      if (toBool(debug.all) !== undefined) return toBool(debug.all);
      const keyVariants = [namespace, namespace?.toLowerCase?.(), namespace?.toUpperCase?.()];
      for (const key of keyVariants) {
        if (key && key in debug) {
          const val = toBool(debug[key]);
          if (val !== undefined) return val;
        }
      }
    }
  } catch {}
  return undefined;
}

export function createDebugLogger(namespace, { envKey } = {}) {
  const envFlag = toBool(readEnvFlag(envKey));
  const global = globalFlag(namespace);
  const enabled = global !== undefined ? global : envFlag === undefined ? false : envFlag;

  const prefix = namespace ? `[${namespace}]` : '';

  const logger = (...args) => {
    if (!enabled) return;
    try {
      if (prefix) console.debug(prefix, ...args);
      else console.debug(...args);
    } catch {}
  };

  logger.enabled = enabled;
  return logger;
}
