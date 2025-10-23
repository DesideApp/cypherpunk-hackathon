import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/* global global */
import { authedFetchJson as fetchJson } from './fetcher.js';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE_NAME,
  CSRF_STORAGE_KEY,
} from '@shared/services/tokenService.js';

const createDomMocks = () => {
  const storage = new Map();
  const ls = {
    getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
    setItem: vi.fn((key, value) => storage.set(key, value)),
    removeItem: vi.fn((key) => storage.delete(key)),
  };

  const ss = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => null),
    removeItem: vi.fn(() => null),
  };

  Object.assign(globalThis, {
    localStorage: ls,
    sessionStorage: ss,
  });

  let cookieJar = '';
  Object.defineProperty(globalThis, 'document', {
    value: {},
    configurable: true,
  });
  Object.defineProperty(globalThis.document, 'cookie', {
    get: () => cookieJar,
    set: (value) => {
      const next = String(value);
      if (!cookieJar) {
        cookieJar = next;
      } else {
        cookieJar = `${cookieJar}; ${next}`;
      }
    },
    configurable: true,
  });
};

describe('fetcher headers', () => {
  let fetchMock;

  beforeEach(() => {
    createDomMocks();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      headers: new Headers(),
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends Authorization and CSRF headers using namespaced cookies', async () => {
    localStorage.setItem(CSRF_STORAGE_KEY, 'csrf_local');
    document.cookie = `${CSRF_COOKIE_NAME}=csrf_cookie; path=/;`;
    document.cookie = `${ACCESS_TOKEN_COOKIE}=token123; path=/;`;

    await fetchJson('/health', { method: 'GET' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer token123');
    expect(options.headers['x-csrf-token']).toBe('csrf_cookie');
  });
});
