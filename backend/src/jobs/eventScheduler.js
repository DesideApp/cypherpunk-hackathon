import cron from 'node-cron';
import { cleanupRelayByTier } from '#jobs/tasks/cleanupRelayByTier.js';
import config from '#config/appConfig.js';

const RELAY_CLEANUP_CRON = (process.env.RELAY_CLEANUP_CRON || config?.relayCleanupCron || '5 3 * * *').trim();

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

export {};
