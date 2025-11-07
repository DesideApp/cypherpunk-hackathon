import cron from 'node-cron';
import { cleanupRelayByTier } from '#jobs/tasks/cleanupRelayByTier.js';
import { pullActivityEvents } from '#jobs/tasks/pullActivityEvents.js';
import { snapshotOverviewHourly } from '#jobs/tasks/snapshotOverview.js';
import { snapshotOverviewDaily } from '#jobs/tasks/snapshotOverviewDaily.js';
import { reconcileRelayHistory } from '#jobs/tasks/reconcileRelayHistory.js';
import cleanupAttachments from '#jobs/tasks/cleanupAttachments.js';
import {
  recordJobStart,
  recordJobSuccess,
  recordJobError,
} from '#jobs/jobStatusTracker.js';
import config from '#config/appConfig.js';
import { createModuleLogger } from '#config/logger.js';

const log = createModuleLogger({ module: 'jobs.scheduler' });

const RELAY_CLEANUP_CRON = (process.env.RELAY_CLEANUP_CRON || config?.relayCleanupCron || '5 3 * * *').trim();
const ATTACHMENT_CLEANUP_CRON = String(process.env.ATTACHMENT_CLEANUP_CRON || '15 3 * * *').trim();
const ACTIVITY_PULL_CRON = String(process.env.ACTIVITY_PULL_CRON || '').trim();
const ACTIVITY_PULL_LIMIT = Number.parseInt(process.env.ACTIVITY_PULL_LIMIT ?? '100', 10);
const ACTIVITY_PULL_DRY_RUN = String(process.env.ACTIVITY_PULL_DRY_RUN ?? 'true').toLowerCase() === 'true';

function scheduleCleanup(cronExpr) {
  cron.schedule(cronExpr, async () => {
    log.info('cron_cleanup_start', { cronExpr });
    recordJobStart('cleanupRelayByTier', { cronExpr });
    try {
      const res = await cleanupRelayByTier({ dryRun: false });
      log.info('cron_cleanup_success', {
        cronExpr,
        removed: res?.totals?.removed ?? 0,
        freedBytes: res?.totals?.freedBytes ?? 0,
        durationMs: res?.durationMs ?? null,
      });
      recordJobSuccess('cleanupRelayByTier', {
        removed: res?.totals?.removed ?? 0,
        freedBytes: res?.totals?.freedBytes ?? 0,
        durationMs: res?.durationMs ?? null,
      });
    } catch (e) {
      log.error('cron_cleanup_error', {
        cronExpr,
        error: e?.stack || e?.message || e,
      });
      recordJobError('cleanupRelayByTier', e);
    }
  });
}

try {
  scheduleCleanup(RELAY_CLEANUP_CRON);
} catch (e) {
  log.error('cron_cleanup_invalid', {
    cronExpr: RELAY_CLEANUP_CRON,
    error: e?.message || e,
  });
  scheduleCleanup('*/30 * * * *');
  recordJobError('cleanupRelayByTier', e);
}

log.info('cron_cleanup_scheduled', { cronExpr: RELAY_CLEANUP_CRON });

try {
  cron.schedule(ATTACHMENT_CLEANUP_CRON, async () => {
    log.info('cron_attachment_cleanup_start', { cronExpr: ATTACHMENT_CLEANUP_CRON });
    recordJobStart('cleanupAttachments', { cronExpr: ATTACHMENT_CLEANUP_CRON });
    try {
      const res = await cleanupAttachments({ dryRun: false });
      log.info('cron_attachment_cleanup_success', { ...res });
      recordJobSuccess('cleanupAttachments', res);
    } catch (error) {
      log.error('cron_attachment_cleanup_error', {
        error: error?.stack || error?.message || error,
      });
      recordJobError('cleanupAttachments', error);
    }
  });
  log.info('cron_attachment_cleanup_scheduled', { cronExpr: ATTACHMENT_CLEANUP_CRON });
} catch (error) {
  log.error('cron_attachment_cleanup_schedule_error', { error: error?.message || error });
  recordJobError('cleanupAttachments', error);
}

// Snapshots: cada hora a :05 tomamos snapshot de la hora anterior
try {
  cron.schedule('5 * * * *', async () => {
    recordJobStart('snapshotOverviewHourly', { cronExpr: '5 * * * *' });
    try {
      const res = await snapshotOverviewHourly();
      log.info('cron_snapshot_hourly_success', {
        file: res.file,
      });
      recordJobSuccess('snapshotOverviewHourly', { file: res.file });
    } catch (err) {
      log.error('cron_snapshot_hourly_error', {
        error: err?.stack || err?.message || err,
      });
      recordJobError('snapshotOverviewHourly', err);
    }
  });
  log.info('cron_snapshot_hourly_scheduled', { cronExpr: '5 * * * *' });
} catch (e) {
  log.error('cron_snapshot_hourly_schedule_error', {
    error: e?.message || e,
  });
  recordJobError('snapshotOverviewHourly', e);
}

// Snapshot diario (día anterior) a las 00:10
try {
  cron.schedule('10 0 * * *', async () => {
    recordJobStart('snapshotOverviewDaily', { cronExpr: '10 0 * * *' });
    try {
      const res = await snapshotOverviewDaily();
      log.info('cron_snapshot_daily_success', { file: res.file });
      recordJobSuccess('snapshotOverviewDaily', { file: res.file });
    } catch (err) {
      log.error('cron_snapshot_daily_error', {
        error: err?.stack || err?.message || err,
      });
      recordJobError('snapshotOverviewDaily', err);
    }
  });
  log.info('cron_snapshot_daily_scheduled', { cronExpr: '10 0 * * *' });
} catch (e) {
  log.error('cron_snapshot_daily_schedule_error', { error: e?.message || e });
  recordJobError('snapshotOverviewDaily', e);
}

// Reconciliación relay ↔ history diaria a las 02:30
try {
  cron.schedule('30 2 * * *', async () => {
    const options = {
      batchSize: Number.parseInt(process.env.RECONCILE_BATCH_SIZE ?? '0', 10),
      repair: String(process.env.RECONCILE_REPAIR ?? 'true').toLowerCase() !== 'false',
      checkHistory: String(process.env.RECONCILE_CHECK_HISTORY ?? 'true').toLowerCase() !== 'false',
    };
    log.info('cron_reconcile_start', options);
    recordJobStart('reconcileRelayHistory', options);
    try {
      const res = await reconcileRelayHistory(options);
      log.info('cron_reconcile_success', { ...res });
      recordJobSuccess('reconcileRelayHistory', res);
    } catch (err) {
      log.error('cron_reconcile_error', {
        error: err?.stack || err?.message || err,
      });
      recordJobError('reconcileRelayHistory', err);
    }
  });
  log.info('cron_reconcile_scheduled', { cronExpr: '30 2 * * *' });
} catch (error) {
  log.error('cron_reconcile_schedule_error', { error: error?.message || error });
  recordJobError('reconcileRelayHistory', error);
}

if (ACTIVITY_PULL_CRON) {
  try {
    cron.schedule(ACTIVITY_PULL_CRON, async () => {
      log.info('cron_activity_pull_start', { cronExpr: ACTIVITY_PULL_CRON, dryRun: ACTIVITY_PULL_DRY_RUN });
      recordJobStart('pullActivityEvents', { cronExpr: ACTIVITY_PULL_CRON, dryRun: ACTIVITY_PULL_DRY_RUN });
      try {
        const res = await pullActivityEvents({
          limit: Number.isFinite(ACTIVITY_PULL_LIMIT) && ACTIVITY_PULL_LIMIT > 0 ? ACTIVITY_PULL_LIMIT : 100,
          dryRun: ACTIVITY_PULL_DRY_RUN,
        });
        log.info('cron_activity_pull_success', {
          cronExpr: ACTIVITY_PULL_CRON,
          processed: res?.processed ?? 0,
          durationMs: res?.durationMs ?? 0,
          dryRun: res?.dryRun,
        });
        recordJobSuccess('pullActivityEvents', {
          processed: res?.processed ?? 0,
          durationMs: res?.durationMs ?? 0,
          dryRun: res?.dryRun,
        });
      } catch (error) {
        log.error('cron_activity_pull_error', {
          cronExpr: ACTIVITY_PULL_CRON,
          error: error?.stack || error?.message || error,
        });
        recordJobError('pullActivityEvents', error);
      }
    });
    log.info('cron_activity_pull_scheduled', { cronExpr: ACTIVITY_PULL_CRON, dryRun: ACTIVITY_PULL_DRY_RUN });
  } catch (error) {
    log.error('cron_activity_pull_schedule_error', {
      cronExpr: ACTIVITY_PULL_CRON,
      error: error?.message || error,
    });
    recordJobError('pullActivityEvents', error);
  }
} else {
  log.info('cron_activity_pull_inactive');
}

export {};
