import cron from 'node-cron';
import { cleanupRelayByTier } from '#jobs/tasks/cleanupRelayByTier.js';
import { pullActivityEvents } from '#jobs/tasks/pullActivityEvents.js';
import { snapshotOverviewHourly } from '#jobs/tasks/snapshotOverview.js';
import { snapshotOverviewDaily } from '#jobs/tasks/snapshotOverviewDaily.js';
import config from '#config/appConfig.js';

const RELAY_CLEANUP_CRON = (process.env.RELAY_CLEANUP_CRON || config?.relayCleanupCron || '5 3 * * *').trim();
const ACTIVITY_PULL_CRON = String(process.env.ACTIVITY_PULL_CRON || '').trim();
const ACTIVITY_PULL_LIMIT = Number.parseInt(process.env.ACTIVITY_PULL_LIMIT ?? '100', 10);
const ACTIVITY_PULL_DRY_RUN = String(process.env.ACTIVITY_PULL_DRY_RUN ?? 'true').toLowerCase() === 'true';

function scheduleCleanup(cronExpr) {
  cron.schedule(cronExpr, async () => {
    console.log(`🧹 Ejecutando limpieza relay por tier (CRON="${cronExpr}") …`);
    try {
      const res = await cleanupRelayByTier({ dryRun: false });
      console.log(
        `✅ Limpieza OK: removed=${res?.totals?.removed ?? 0} freed=${Math.round((res?.totals?.freedBytes ?? 0) / 1024)}KB in ${res?.durationMs ?? '?'}ms`
      );
    } catch (e) {
      console.error('❌ Limpieza relay error:', e?.message || e);
    }
  });
}

try {
  scheduleCleanup(RELAY_CLEANUP_CRON);
} catch (e) {
  console.error(
    `❌ Cron inválido (${RELAY_CLEANUP_CRON}). Usando fallback "*/30 * * * *". Motivo:`,
    e?.message || e
  );
  scheduleCleanup('*/30 * * * *');
}

console.log(`✅ Job programado: Limpieza relay (${RELAY_CLEANUP_CRON})`);

// Snapshots: cada hora a :05 tomamos snapshot de la hora anterior
try {
  cron.schedule('5 * * * *', async () => {
    try {
      const res = await snapshotOverviewHourly();
      console.log('📝 Snapshot overview OK:', res.file);
    } catch (err) {
      console.error('❌ Snapshot overview error:', err?.message || err);
    }
  });
  console.log('✅ Job programado: Snapshot overview (5 * * * *)');
} catch (e) {
  console.error('❌ No se pudo programar snapshot overview:', e?.message || e);
}

// Snapshot diario (día anterior) a las 00:10
try {
  cron.schedule('10 0 * * *', async () => {
    try {
      const res = await snapshotOverviewDaily();
      console.log('📝 Snapshot daily overview OK:', res.file);
    } catch (err) {
      console.error('❌ Snapshot daily overview error:', err?.message || err);
    }
  });
  console.log('✅ Job programado: Snapshot overview daily (10 0 * * *)');
} catch (e) {
  console.error('❌ No se pudo programar snapshot daily overview:', e?.message || e);
}

if (ACTIVITY_PULL_CRON) {
  try {
    cron.schedule(ACTIVITY_PULL_CRON, async () => {
      console.log(`🔁 Poll actividad (CRON="${ACTIVITY_PULL_CRON}") …`);
      try {
        const res = await pullActivityEvents({
          limit: Number.isFinite(ACTIVITY_PULL_LIMIT) && ACTIVITY_PULL_LIMIT > 0 ? ACTIVITY_PULL_LIMIT : 100,
          dryRun: ACTIVITY_PULL_DRY_RUN,
        });
        console.log(
          `✅ Poll actividad OK: processed=${res?.processed ?? 0} duration=${res?.durationMs ?? 0}ms dryRun=${res?.dryRun}`
        );
      } catch (error) {
        console.error('❌ Poll actividad error:', error?.message || error);
      }
    });
    console.log(`✅ Job programado: Poll actividad (${ACTIVITY_PULL_CRON}) dryRun=${ACTIVITY_PULL_DRY_RUN}`);
  } catch (error) {
    console.error('❌ Cron poll actividad inválido. Define ACTIVITY_PULL_CRON con un valor válido.', error?.message || error);
  }
} else {
  console.log('ℹ️ Poll actividad inactivo (define ACTIVITY_PULL_CRON para habilitarlo).');
}

export {};
