const ENABLED = (() => {
  try {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RTC_DEBUG);
    if (String(v).toLowerCase() === 'true') return true;
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.VITE_RTC_DEBUG) {
      return String(window.__ENV__.VITE_RTC_DEBUG).toLowerCase() === 'true';
    }
  } catch {}
  // fallback: enable in dev
  try { return !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV); } catch {}
  return false;
})();

export function rtcDebug(event, payload) {
  if (!ENABLED) return;
  try { console.info(`[rtc:${event}]`, payload); } catch {}
}

export default rtcDebug;
