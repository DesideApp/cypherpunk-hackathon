// Limpieza de solicitudes pendientes expiradas
import Contact from "#modules/contacts/models/contact.model.js";
import { ContactStatus, CONTACT_TTL_DAYS } from "#modules/contacts/contact.constants.js";

export async function cleanupPendingDMsOnce(logger = console) {
  const now = new Date();
  const res = await Contact.updateMany(
    {
      status: { $in: [ContactStatus.PENDING_OUT, ContactStatus.PENDING_IN] },
      expiresAt: { $lte: now },
    },
    { $set: { status: ContactStatus.CLOSED } }
  );
  // Opcional: borrar docs CLOSED que ya expiren X tiempo más tarde
  logger.info?.(
    `[cleanupPendingDMs] closed=${res.modifiedCount} ttl=${CONTACT_TTL_DAYS}d`
  );
}

export function registerCleanupPendingDMs(intervalMinutes = 60) {
  // simple setInterval para MVP (puedes usar node-cron)
  setInterval(() => {
    cleanupPendingDMsOnce().catch((e) =>
      console.error("[cleanupPendingDMs] error", e)
    );
  }, intervalMinutes * 60 * 1000);
}
