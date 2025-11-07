import { getJobStatuses } from '#jobs/jobStatusTracker.js';

export async function listJobStatuses(req, res) {
  try {
    const jobs = getJobStatuses();
    const reconcile = jobs?.reconcileRelayHistory?.result || null;
    const metrics = reconcile
      ? {
          relayHistoryChecked: reconcile.checked ?? null,
          relayHistoryMissingInHistory: reconcile.missingInHistory ?? null,
          relayHistoryRepaired: reconcile.repaired ?? null,
          relayHistoryMissingInRelay: reconcile.missingInRelay ?? null,
        }
      : null;
    return res.status(200).json({ jobs, metrics });
  } catch (error) {
    return res.status(500).json({ error: 'FAILED_TO_GET_JOB_STATUS', message: error?.message || 'Internal error' });
  }
}

export default { listJobStatuses };
