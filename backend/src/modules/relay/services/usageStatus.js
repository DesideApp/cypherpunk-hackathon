// src/modules/relay/services/usageStatus.js
//
// Helper to compute usage ratios and statuses consistently across the codebase.

/**
 * Computes usage ratio and status taking warning/critical ratios into account.
 * @param {number} usedBytes
 * @param {number} quotaBytes
 * @param {number} warningRatio
 * @param {number} criticalRatio
 * @returns {{ ratio: number, status: 'ok'|'warning'|'critical'}}
 */
export function computeUsageStatus(usedBytes, quotaBytes, warningRatio, criticalRatio) {
  const safeQuota = Number.isFinite(quotaBytes) && quotaBytes > 0 ? quotaBytes : 0;
  const ratio = safeQuota > 0 ? usedBytes / safeQuota : 0;
  const warning = Number.isFinite(warningRatio) ? warningRatio : 0.8;
  const critical = Number.isFinite(criticalRatio) ? criticalRatio : 0.95;

  if (ratio >= critical) return { ratio, status: 'critical' };
  if (ratio >= warning) return { ratio, status: 'warning' };
  return { ratio, status: 'ok' };
}

export default computeUsageStatus;
