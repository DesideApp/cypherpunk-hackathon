import { WaErrorCode, waErr } from './errors';

export function mapProviderError(err: any, phase: 'connect'|'disconnect'|'sign'): never {
  const msg = String(err?.message || '');
  const code = err?.code;

  // Rechazo de usuario (EIP-1193 style)
  if (code === 4001 || /reject/i.test(msg)) {
    throw waErr(
      phase === 'sign' ? WaErrorCode.SIGN_REJECTED : WaErrorCode.CONNECT_REJECTED,
      phase === 'sign' ? 'User rejected signing' : 'User rejected connection',
      'provider',
      { code, msg }
    );
  }

  // Wallet bloqueada / no confiada aún
  if (/locked/i.test(msg) || err?.locked === true) {
    throw waErr(WaErrorCode.PROVIDER_LOCKED, 'Wallet is locked', 'provider', { code, msg });
  }

  // Faltan capacidades
  if (phase === 'sign' && /not.*support|unsupported/i.test(msg)) {
    throw waErr(WaErrorCode.SIGN_UNSUPPORTED, 'signMessage not supported by wallet', 'provider', { code, msg });
  }

  // Genérico por fase
  throw waErr(
    phase === 'sign' ? WaErrorCode.SIGN_FAILED
    : phase === 'disconnect' ? WaErrorCode.DISCONNECT_FAILED
    : WaErrorCode.CONNECT_FAILED,
    msg || 'Provider error',
    'provider',
    { code, msg },
    err
  );
}
