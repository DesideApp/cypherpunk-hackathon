// src/jobs/tasks/cleanupRelayByTier.js
import RelayMessage from "#modules/relay/models/relayMessage.model.js";
import User from "#modules/users/models/user.model.js";

let running = false;

function fmtKB(bytes) {
  return `${Math.round((bytes || 0) / 1024)}KB`;
}

/**
 * Limpia mensajes expirados por TTL del usuario y recalcula relayUsedBytes.
 * - Idempotente: tras borrar, fija relayUsedBytes al sum(boxSize) actual.
 * - Por defecto TTL 5 días si el usuario no tiene relayTTLSeconds.
 * - Devuelve totales globales y por tier.
 */
export async function cleanupRelayByTier(opts = {}) {
  if (running) {
    console.warn("[cleanupRelayByTier] ya está en ejecución; se omite.");
    return { skipped: true };
  }
  running = true;

  const dryRun = !!opts.dryRun;
  const started = Date.now();

  let totals = { removed: 0, freedBytes: 0 };
  const perTier = Object.create(null);

  try {
    console.log("🧹 [cleanupRelayByTier] Inicio … (dryRun:", dryRun, ")");

    // Iteramos con cursor para no cargar todos los usuarios en memoria
    const cursor = User.find({}, { wallet: 1, relayTTLSeconds: 1, relayTier: 1 }).cursor();

    for await (const user of cursor) {
      const wallet = user.wallet;
      const tier = user.relayTier || "basic";
      const ttlSeconds = Number(user.relayTTLSeconds || 5 * 24 * 3600);
      const threshold = new Date(Date.now() - ttlSeconds * 1000);

      // 1) Calcular cuántos y cuántos bytes expiran (agregación)
      const [expiredStats] = await RelayMessage.aggregate([
        { $match: { to: wallet, createdAt: { $lt: threshold } } },
        { $group: { _id: null, n: { $sum: 1 }, bytes: { $sum: "$boxSize" } } },
      ]);

      const expiredN = expiredStats?.n || 0;
      const expiredBytes = expiredStats?.bytes || 0;

      // 2) Borrar vencidos (si los hay)
      if (!dryRun && expiredN > 0) {
        await RelayMessage.deleteMany({ to: wallet, createdAt: { $lt: threshold } });
      }

      // 3) Recalcular uso actual (suma de todo lo restante)
      const [remainStats] = await RelayMessage.aggregate([
        { $match: { to: wallet } },
        { $group: { _id: null, n: { $sum: 1 }, bytes: { $sum: "$boxSize" } } },
      ]);

      const remainN = remainStats?.n || 0;
      const remainBytes = remainStats?.bytes || 0;

      if (!dryRun) {
        await User.updateOne({ wallet }, { $set: { relayUsedBytes: remainBytes } });
      }

      // 4) Acumular métricas
      if (!perTier[tier]) perTier[tier] = { removed: 0, freedBytes: 0, remainBytes: 0, users: 0 };
      perTier[tier].removed += expiredN;
      perTier[tier].freedBytes += expiredBytes;
      perTier[tier].remainBytes += remainBytes;
      perTier[tier].users += 1;

      if (expiredN > 0) {
        console.log(
          `   • ${wallet} [${tier}] → removed=${expiredN} freed=${fmtKB(expiredBytes)} remain=${fmtKB(
            remainBytes
          )} (${remainN} msgs)`
        );
      }

      totals.removed += expiredN;
      totals.freedBytes += expiredBytes;
    }

    const durationMs = Date.now() - started;
    console.log(
      `✅ [cleanupRelayByTier] Fin: removed=${totals.removed} freed=${fmtKB(
        totals.freedBytes
      )} in ${durationMs}ms`
    );
    Object.entries(perTier).forEach(([t, v]) => {
      console.log(
        `   • tier=${t}: removed=${v.removed} freed=${fmtKB(v.freedBytes)} users=${v.users} remain=${fmtKB(
          v.remainBytes
        )}`
      );
    });

    return { totals, perTier, durationMs, dryRun };
  } catch (error) {
    console.error("❌ [cleanupRelayByTier] Error:", error?.message || error);
    return { error: true, message: error?.message || String(error) };
  } finally {
    running = false;
  }
}
