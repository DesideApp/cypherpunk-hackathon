// src/shared/utils/base64.js
// Utilidades centralizadas para conversión base64/UTF-8

export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function base64ToUtf8(b64) {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

// Alias para compatibilidad con código existente
export const b64ToUtf8 = base64ToUtf8;
export const utf8ToB64 = utf8ToBase64;
