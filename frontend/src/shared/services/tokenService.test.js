import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  storeCSRFToken,
  getStoredCSRFToken,
  storeWalletSignature,
  getWalletSignature,
  clearWalletSignature,
  hasSessionTokens,
  emitSessionExpired,
  clearSession,
  CSRF_STORAGE_KEY,
  WALLET_SIGNATURE_KEY,
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE_NAME,
  readCookie
} from './tokenService.js';

const createDomMocks = () => {
  const storage = new Map();
  const ls = {
    getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
    setItem: vi.fn((key, value) => storage.set(key, value)),
    removeItem: vi.fn((key) => storage.delete(key))
  };
  Object.assign(globalThis, {
    localStorage: ls,
    sessionStorage: { removeItem: vi.fn() }
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      cookie: '',
      match(string) {
        return this.cookie.match(string);
      }
    },
    configurable: true
  });

  Object.defineProperty(globalThis, 'window', {
    value: {
      dispatchEvent: vi.fn()
    },
    configurable: true
  });
};

describe('tokenService', () => {
  beforeEach(() => {
    createDomMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores and retrieves CSRF token (localStorage + cookie)', () => {
    storeCSRFToken('foo');
    expect(localStorage.setItem).toHaveBeenCalledWith(CSRF_STORAGE_KEY, 'foo');
    expect(getStoredCSRFToken()).toBe('foo');

    document.cookie = `${CSRF_COOKIE_NAME}=bar; path=/;`;
    expect(getStoredCSRFToken()).toBe('bar');
  });

  it('stores and clears wallet signature', () => {
    expect(getWalletSignature()).toBeNull();
    storeWalletSignature('sig123');
    expect(localStorage.setItem).toHaveBeenCalledWith(WALLET_SIGNATURE_KEY, 'sig123');
    expect(getWalletSignature()).toBe('sig123');
    clearWalletSignature();
    expect(localStorage.removeItem).toHaveBeenCalledWith(WALLET_SIGNATURE_KEY);
  });

  it('detects session tokens/cookies', () => {
    expect(hasSessionTokens()).toBe(false);
    localStorage.setItem(CSRF_STORAGE_KEY, 'csrf');
    expect(hasSessionTokens()).toBe(true);

    document.cookie = `${ACCESS_TOKEN_COOKIE}=abc; path=/;`;
    expect(hasSessionTokens()).toBe(true);
    expect(readCookie(ACCESS_TOKEN_COOKIE)).toBe('abc');
  });

  it('emits sessionExpired only once per debounce window', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    emitSessionExpired('expired');
    emitSessionExpired('again');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clears session data', () => {
    localStorage.setItem(CSRF_STORAGE_KEY, 'foo');
    document.cookie = `${CSRF_COOKIE_NAME}=foo; path=/;`;
    clearSession('logout');
    expect(localStorage.removeItem).toHaveBeenCalledWith(CSRF_STORAGE_KEY);
    expect(document.cookie).toBe(`${CSRF_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`);
  });
});
