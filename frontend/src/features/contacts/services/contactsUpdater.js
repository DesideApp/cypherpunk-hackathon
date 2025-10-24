import { fetchContacts } from "./contactService";
import userDirectory from "@shared/services/userDirectory.js";

/**
 * 🔹 Carga y procesa el estado completo de los contactos
 * @returns {Object} { confirmed, pending, incoming (procesados) }
 */
export async function getUpdatedContacts() {
  try {
    const contacts = await fetchContacts();

    const confirmed = contacts.confirmed || [];
    const pending = contacts.pending || [];
    const incomingRaw = contacts.incoming || [];

    // 1) Recolectar pubkeys únicas y hacer batch fetch (primará el directorio)
    const allPubkeys = new Set([
      ...confirmed.map((c) => c.wallet).filter(Boolean),
      ...pending.map((c) => c.wallet).filter(Boolean),
      ...incomingRaw.map((c) => c.wallet).filter(Boolean),
    ]);
    await userDirectory.fetchMany(Array.from(allPubkeys));

    // 2) Helper: aplica datos del directorio
    const withProfile = (item) => {
      const prof = userDirectory.getUser(item.wallet);
      return {
        ...item,
        nickname: prof?.registered ? prof.nickname : null,
        avatar: prof?.registered ? prof.avatar : null,
        blocked: prof?.registered ? !!prof.blocked : false,
      };
    };

    const confirmedEnriched = confirmed.map(withProfile);
    const pendingEnriched = pending.map(withProfile);
    const incoming = incomingRaw.map(withProfile);

    return { confirmed: confirmedEnriched, pending: pendingEnriched, incoming };
  } catch (error) {
    console.error("❌ Error cargando contactos:", error);
    return { confirmed: [], pending: [], incoming: [] };
  }
}
