import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  storeCSRFToken,
  getStoredCSRFToken,
  storeWalletSignature,
  getWalletSignature,
  clearWalletSignature,
  hasSessionTokens,
  emitSessionExpired,
  clearSession
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
    expect(localStorage.setItem).toHaveBeenCalledWith('csrfToken', 'foo');
    expect(getStoredCSRFToken()).toBe('foo');

    document.cookie = 'csrfToken=bar; path=/;';
    expect(getStoredCSRFToken()).toBe('bar');
  });

  it('stores and clears wallet signature', () => {
    expect(getWalletSignature()).toBeNull();
    storeWalletSignature('sig123');
    expect(localStorage.setItem).toHaveBeenCalledWith('walletSignature', 'sig123');
    expect(getWalletSignature()).toBe('sig123');
    clearWalletSignature();
    expect(localStorage.removeItem).toHaveBeenCalledWith('walletSignature');
  });

  it('detects session tokens/cookies', () => {
    expect(hasSessionTokens()).toBe(false);
    localStorage.setItem('csrfToken', 'csrf');
    expect(hasSessionTokens()).toBe(true);

    document.cookie = 'accessToken=abc; path=/;';
    expect(hasSessionTokens()).toBe(true);
  });

  it('emits sessionExpired only once per debounce window', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    emitSessionExpired('expired');
    emitSessionExpired('again');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clears session data', () => {
    localStorage.setItem('csrfToken', 'foo');
    document.cookie = 'csrfToken=foo; path=/;';
    clearSession('logout');
    expect(localStorage.removeItem).toHaveBeenCalledWith('csrfToken');
    expect(document.cookie).toBe('csrfToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;');
  });
});
