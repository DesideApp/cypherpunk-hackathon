import { getJobStatuses, getJobHistory } from '#jobs/jobStatusTracker.js';

const JOB_EXPECTED_INTERVALS = {
  snapshotOverviewHourly: 60 * 60 * 1000,
  snapshotOverviewDaily: 24 * 60 * 60 * 1000,
  cleanupRelayByTier: 24 * 60 * 60 * 1000,
  cleanupAttachments: 24 * 60 * 60 * 1000,
  reconcileRelayHistory: 24 * 60 * 60 * 1000,
};

function buildAlert(key, status) {
  if (!status) return null;
  const alerts = [];
  const now = Date.now();
  const finishedAt = status.finishedAt || status.startedAt || null;
  if (status.status === 'error') {
    alerts.push({ type: 'error', message: 'Última ejecución terminó en error', at: finishedAt, job: key });
  }
  const expectedInterval = JOB_EXPECTED_INTERVALS[key];
  if (expectedInterval && finishedAt) {
    const elapsed = now - finishedAt;
    if (elapsed > expectedInterval * 1.5) {
      alerts.push({
        type: 'stale',
        message: `Sin ejecuciones recientes (${Math.round(elapsed / 60000)} min sin correr)`,
        at: finishedAt,
        job: key,
      });
    }
  }
  if (key === 'snapshotOverviewDaily' && Array.isArray(status.result?.missingHours) && status.result.missingHours.length > 0) {
    alerts.push({
      type: 'gap',
      message: `Faltan ${status.result.missingHours.length} horas en el último snapshot diario`,
      at: finishedAt,
      job: key,
      details: status.result.missingHours.slice(0, 6),
    });
  }
  if (key === 'snapshotOverviewHourly' && Array.isArray(status.result?.missingHours) && status.result.missingHours.length > 0) {
    alerts.push({
      type: 'gap',
      message: `Huecos en snapshots horarios (${status.result.missingHours.length})`,
      at: finishedAt,
      job: key,
      details: status.result.missingHours.slice(0, 10),
    });
  }
  return alerts;
}

export async function listJobStatuses(req, res) {
  try {
    const jobs = getJobStatuses();
    const history = getJobHistory(12);
    const alerts = Object.entries(jobs || {}).flatMap(([name, status]) => buildAlert(name, status) || []);
    const reconcile = jobs?.reconcileRelayHistory?.result || null;
    const metrics = reconcile
      ? {
          relayHistoryChecked: reconcile.checked ?? null,
          relayHistoryMissingInHistory: reconcile.missingInHistory ?? null,
          relayHistoryRepaired: reconcile.repaired ?? null,
          relayHistoryMissingInRelay: reconcile.missingInRelay ?? null,
        }
      : null;
    return res.status(200).json({ jobs, history, alerts, metrics });
  } catch (error) {
    return res.status(500).json({ error: 'FAILED_TO_GET_JOB_STATUS', message: error?.message || 'Internal error' });
  }
}

export default { listJobStatuses };
