import { describe, expect, it } from 'vitest';
import { utf8ToBase64, base64ToUtf8 } from './base64.js';

describe('base64 utils', () => {
  it('round-trips UTF-8 strings', () => {
    const original = 'Hola 🌍 – prueba ñ/漢字';
    const encoded = utf8ToBase64(original);
    const decoded = base64ToUtf8(encoded);
    expect(decoded).toBe(original);
  });

  it('handles empty strings', () => {
    expect(base64ToUtf8('')).toBe('');
    expect(utf8ToBase64('')).toBe('');
  });

  it('returns undefined for invalid base64', () => {
    expect(base64ToUtf8('@@invalid@@')).toBeUndefined();
  });
});
