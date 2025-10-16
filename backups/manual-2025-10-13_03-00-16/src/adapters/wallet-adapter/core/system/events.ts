import type { WaError } from '../error-handling/errors';

export type WaEventMap = {
  'wa:error': { error: WaError };
  'wa:status': { status: 'idle'|'connecting'|'connected'|'locked'|'error'; wallet?: string|null };
  'wa:telemetry': { name: string; t0?: number; dt?: number; meta?: Record<string,unknown> };
};

export function emit<E extends keyof WaEventMap>(type: E, payload: WaEventMap[E]) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(String(type), { detail: payload }));
}

export function on<E extends keyof WaEventMap>(type: E, handler: (p: WaEventMap[E]) => void) {
  const fn = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(String(type), fn);
  return () => window.removeEventListener(String(type), fn);
}
