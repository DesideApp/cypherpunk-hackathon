import crypto from 'node:crypto';
import bs58 from 'bs58';

export const PLAN_FREE = 'free';
export const PLAN_PLUS = 'plus';

export function deriveWallet(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  return bs58.encode(hash.subarray(0, 32));
}

export function chooseWallets(plan) {
  const prefix = plan === PLAN_PLUS ? PLAN_PLUS : PLAN_FREE;
  return {
    sender: deriveWallet(`${prefix}-sender`),
    recipients: [
      { wallet: deriveWallet(`${prefix}-warning`), label: 'warning' },
      { wallet: deriveWallet(`${prefix}-critical`), label: 'critical' },
      { wallet: deriveWallet(`${prefix}-grace`), label: 'grace' },
      { wallet: deriveWallet(`${prefix}-fresh`), label: 'fresh' },
    ],
  };
}
