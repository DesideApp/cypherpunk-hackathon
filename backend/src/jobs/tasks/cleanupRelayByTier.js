// src/jobs/tasks/cleanupRelayByTier.js
import User from "#modules/users/models/user.model.js";
import logEvent from "#modules/stats/services/eventLogger.service.js";
import config from "#config/appConfig.js";
import { getRelayStore } from '#modules/relay/services/relayStoreProvider.js';
import { createModuleLogger } from '#config/logger.js';

const log = createModuleLogger({ module: 'jobs.cleanupRelayByTier' });

let running = false;

/**
 * Limpia mensajes expirados por TTL del usuario y recalcula relayUsedBytes.
 * - Idempotente: tras borrar, fija relayUsedBytes al sum(boxSize) actual.
 * - Por defecto TTL 5 días si el usuario no tiene relayTTLSeconds.
 * - Devuelve totales globales y por tier.
 */
export async function cleanupRelayByTier(opts = {}) {
  if (running) {
    log.warn('cleanup_skip_running');
    return { skipped: true };
  }
  running = true;

  const dryRun = !!opts.dryRun;
  const started = Date.now();

  let totals = { removed: 0, freedBytes: 0 };
  const perTier = Object.create(null);

  try {
    log.info('cleanup_start', { dryRun });

    // Iteramos con cursor para no cargar todos los usuarios en memoria
    const cursor = User.find({}, { wallet: 1, relayTTLSeconds: 1, relayTier: 1 }).cursor();

    const relayStore = getRelayStore();

    for await (const user of cursor) {
      const wallet = user.wallet;
      const rawTier = user.relayTier || "free";
      const tierKey = rawTier === "basic" ? "free" : rawTier;
      const tierDef = config.tiers[tierKey] || config.tiers.free;
      const ttlSeconds = Number(
        user.relayTTLSeconds ||
          tierDef?.ttlSeconds ||
          config.relayGlobalTtlSeconds
      );
      const quotaBytes = Number(
        user.relayQuotaBytes ?? tierDef?.quotaBytes ?? 0
      );
      const warningRatio =
        Number.isFinite(tierDef?.warningRatio) && tierDef.warningRatio > 0
          ? tierDef.warningRatio
          : config.relayWarningRatio;
      const currentUsed = Number(user.relayUsedBytes ?? 0);
      const currentRatio =
        quotaBytes > 0 ? Math.min(1, currentUsed / quotaBytes) : 0;
      const enforceTtl = currentRatio >= warningRatio;

      const threshold = new Date(Date.now() - ttlSeconds * 1000);

      const expiredStats = await relayStore.countExpired(wallet, threshold);
      const expiredN = expiredStats.count;
      const expiredBytes = expiredStats.bytes;

      // 2) Borrar vencidos (si los hay)
      if (!dryRun && expiredN > 0 && enforceTtl) {
        const purgeResult = await relayStore.deleteExpired(wallet, threshold);
        try {
          await logEvent(wallet, 'relay_purged_ttl', {
            count: purgeResult.deleted,
            freedBytes: purgeResult.freedBytes,
          });
        } catch {}
      }

      const snapshot = await relayStore.mailboxSnapshot(wallet);
      const remainN = snapshot.count;
      const remainBytes = snapshot.bytes;

      if (!dryRun) {
        await User.updateOne({ wallet }, { $set: { relayUsedBytes: remainBytes } });
      }

      // 4) Acumular métricas
      if (!perTier[tierKey]) perTier[tierKey] = { removed: 0, freedBytes: 0, remainBytes: 0, users: 0 };
      if (enforceTtl) {
        perTier[tierKey].removed += expiredN;
        perTier[tierKey].freedBytes += expiredBytes;
      }
      perTier[tierKey].remainBytes += remainBytes;
      perTier[tierKey].users += 1;

      if (expiredN > 0) {
        log.info('cleanup_expired', {
          wallet,
          tier: tierKey,
          expiredCount: expiredN,
          expiredBytes,
          enforceTtl,
          remainMessages: remainN,
          remainBytes,
        });
      }

      if (enforceTtl) {
        totals.removed += expiredN;
        totals.freedBytes += expiredBytes;
      }
    }

    const durationMs = Date.now() - started;
    log.info('cleanup_finish', {
      removedTotal: totals.removed,
      freedBytesTotal: totals.freedBytes,
      durationMs,
    });
    Object.entries(perTier).forEach(([t, v]) => {
      log.info('cleanup_tier_summary', {
        tier: t,
        removed: v.removed,
        freedBytes: v.freedBytes,
        remainBytes: v.remainBytes,
        users: v.users,
      });
    });

    return { totals, perTier, durationMs, dryRun };
  } catch (error) {
    log.error('cleanup_error', { error: error?.message || error });
    return { error: true, message: error?.message || String(error) };
  } finally {
    running = false;
  }
}
