import { STORAGE_NS, CACHE_NS } from "@shared/config/env.js";

export function wipeModeData({ reload = true } = {}) {
  try {
    const prefix = `${STORAGE_NS}:`;
    const sessionPrefix = `${STORAGE_NS}:`;
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith(sessionPrefix)) sessionStorage.removeItem(key);
    });
  } catch {}

  if (typeof caches !== "undefined" && caches?.keys) {
    caches.keys().then((keys) => {
      keys
        .filter((key) => key.includes(`-${CACHE_NS}-`))
        .forEach((key) => caches.delete(key));
    }).catch(() => {});
  }

  if (reload && typeof window !== "undefined") {
    window.location.reload();
  }
}

export function purgeLegacyStorage() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('deside_msgs_v1:'))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('csrfToken');
  } catch {}
}

export default { wipeModeData, purgeLegacyStorage };
