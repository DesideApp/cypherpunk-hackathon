export enum WaErrorCode {
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  PROVIDER_LOCKED = 'PROVIDER_LOCKED',
  CONNECT_REJECTED = 'CONNECT_REJECTED',
  CONNECT_FAILED = 'CONNECT_FAILED',
  DISCONNECT_FAILED = 'DISCONNECT_FAILED',
  SIGN_UNSUPPORTED = 'SIGN_UNSUPPORTED',
  SIGN_REJECTED = 'SIGN_REJECTED',
  SIGN_FAILED = 'SIGN_FAILED',
  RPC_ERROR = 'RPC_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export type WaErrorSource = 'adapter' | 'provider' | 'rpc' | 'auth';

export class WaError extends Error {
  code: WaErrorCode;
  source: WaErrorSource;
  cause?: unknown;
  details?: Record<string, unknown>;
  constructor(
    code: WaErrorCode,
    message: string,
    source: WaErrorSource = 'adapter',
    details?: Record<string, unknown>,
    cause?: unknown
  ) {
    super(message);
    this.name = 'WaError';
    this.code = code;
    this.source = source;
    this.details = details;
    this.cause = cause;
  }
}

export const isWaError = (e: unknown): e is WaError =>
  !!e && typeof e === 'object' && (e as any).name === 'WaError' && (e as any).code;

export const waErr = (
  code: WaErrorCode,
  message: string,
  source: WaErrorSource = 'adapter',
  details?: Record<string, unknown>,
  cause?: unknown
) => new WaError(code, message, source, details, cause);

// Utilidad para normalizar firmas (si alguna API devuelve bytes)
export const toBase58Signature = (raw: unknown, base58encode: (u8: Uint8Array) => string) => {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Uint8Array) return base58encode(raw);
  if (Array.isArray(raw)) return base58encode(Uint8Array.from(raw));
  if (raw && typeof raw === 'object' && 'signature' in (raw as any)) {
    return base58encode((raw as any).signature as Uint8Array);
  }
  throw waErr(WaErrorCode.SIGN_FAILED, 'Unknown signature type from provider', 'provider');
};
