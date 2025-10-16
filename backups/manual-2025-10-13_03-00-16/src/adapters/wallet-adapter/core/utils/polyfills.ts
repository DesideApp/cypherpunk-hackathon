import { Buffer } from "buffer";
// 1) Buffer global para libs que lo esperan
if (!(globalThis as any).Buffer) (globalThis as any).Buffer = Buffer;

// 1.1) crypto global y subtle (toma window.crypto si existe) — versión robusta
const w: any = (typeof window !== 'undefined' ? window : undefined) as any;
if (w?.crypto) {
  // Asignación segura de globalThis.crypto
  if (!(globalThis as any).crypto) {
    try {
      // Intento directo (may fall in some strict envs)
      (globalThis as any).crypto = w.crypto;
    } catch (_e) {
      try {
        Object.defineProperty(globalThis, 'crypto', {
          value: w.crypto,
          configurable: true,
          enumerable: true,
          writable: false,
        });
      } catch {
        // No podemos forzar el polyfill sin romper el entorno; dejamos la advertencia abajo
      }
    }
  }

  // Asignación segura de subtle si está disponible en window pero no en globalThis.crypto
  if ((globalThis as any).crypto && !(globalThis as any).crypto.subtle && w.crypto.subtle) {
    try {
      (globalThis as any).crypto.subtle = w.crypto.subtle;
    } catch (_e) {
      try {
        Object.defineProperty((globalThis as any).crypto, 'subtle', {
          value: w.crypto.subtle,
          configurable: true,
          enumerable: true,
          writable: false,
        });
      } catch {
        // silencioso
      }
    }
  }
}

// 2) TextEncoder/TextDecoder (suelen existir en browsers modernos)
if (typeof (globalThis as any).TextEncoder === "undefined") {
  // @ts-ignore
  (globalThis as any).TextEncoder = w?.TextEncoder || undefined;
}

if (typeof (globalThis as any).TextDecoder === "undefined") {
  // @ts-ignore
  (globalThis as any).TextDecoder = w?.TextDecoder || undefined;
}

// 3) crypto.subtle (WebCrypto)
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  console.warn("[polyfills] WebCrypto no disponible (crypto.subtle).");
} else {
  // Algunas libs asumen getRandomValues junto a subtle — avisamos si falta
  if (typeof (globalThis as any).crypto.getRandomValues !== 'function') {
    console.warn("[polyfills] crypto.getRandomValues no disponible.");
  }
}

// 4) process.env (vite lo inyecta, pero dejamos shim por si acaso)
if (!(globalThis as any).process) {
  (globalThis as any).process = { env: {} };
}

// 5) Algunas libs esperan `global` (alias de globalThis)
if (!(globalThis as any).global) {
  (globalThis as any).global = globalThis;
}
