export const AgreementStatus = Object.freeze({
  PENDING_B: 'pending_b',
  PENDING_A: 'pending_a',
  SIGNED_BOTH: 'signed_both',
  EXPIRED: 'expired',
});

export function normalizeStatus(status) {
  return AgreementStatus[status?.toUpperCase?.().replace(/[^A-Z_]/g, '')] || AgreementStatus.PENDING_B;
}
