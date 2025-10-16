import { STORAGE_NS } from "@shared/config/env.js";

const CACHE_KEY = `${STORAGE_NS}:contacts`;

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

export const loadContactsCache = () => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { confirmed = [], pending = [], incoming = [], ts = 0 } = parsed;
    return {
      confirmed: Array.isArray(confirmed) ? confirmed : [],
      pending: Array.isArray(pending) ? pending : [],
      incoming: Array.isArray(incoming) ? incoming : [],
      ts: Number.isFinite(ts) ? ts : 0,
    };
  } catch (error) {
    console.warn("[contactsCache] Failed to parse cached contacts", error);
    return null;
  }
};

export const saveContactsCache = ({ confirmed = [], pending = [], incoming = [] }) => {
  if (!isBrowser()) return;
  try {
    const payload = {
      confirmed,
      pending,
      incoming,
      ts: Date.now(),
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[contactsCache] Failed to persist contacts", error);
  }
};

export const clearContactsCache = () => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn("[contactsCache] Failed to clear cache", error);
  }
};

export const CONTACTS_CACHE_KEY = CACHE_KEY;
