// src/jobs/tasks/pullActivityEvents.js
import logger from '#config/logger.js';

/**
 * Extrae eventos de acciones (on-chain o fuentes externas) y los
 * persiste como ActivityEvent.
 *
 * El objetivo es dejar preparado el pipeline; la lógica concreta
 * de indexado se añadirá cuando el indexer esté listo.
 */
export async function pullActivityEvents({ limit = 100, dryRun = false } = {}) {
  const startedAt = Date.now();
  logger?.info?.('[activity] poll start', { limit, dryRun });

  // TODO: Integrar con indexador de Solana Actions / blinks.
  // 1. Obtener lista de transacciones recientes relevantes.
  // 2. Resolver contrapartes/contactos.
  // 3. Persistir eventos mediante recordActivityEvent.

  const durationMs = Date.now() - startedAt;
  logger?.info?.('[activity] poll finish', { processed: 0, durationMs, dryRun });
  return {
    processed: 0,
    dryRun,
    durationMs,
  };
}
