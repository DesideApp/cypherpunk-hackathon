import { fetchContacts } from "./contactService";
import { searchUserByPubkey } from "./userService";

/**
 * 🔹 Carga y procesa el estado completo de los contactos
 * @returns {Object} { confirmed, pending, incoming (procesados) }
 */
export async function getUpdatedContacts() {
  try {
    const contacts = await fetchContacts();

    const confirmed = contacts.confirmed || [];
    const pending = contacts.pending || [];

    // Enriquecer con nickname/avatar para todas las listas (usa cache interna por pubkey)
    const enrich = async (arr = []) => Promise.all(
      arr.map(async (item) => {
        const result = await searchUserByPubkey(item.wallet);
        return {
          ...item,
          nickname: result.registered ? result.nickname : null,
          avatar: result.registered ? result.avatar : null,
          blocked: result.registered ? result.blocked : false,
        };
      })
    );

    const [confirmedEnriched, pendingEnriched, incomingEnriched] = await Promise.all([
      enrich(confirmed),
      enrich(pending),
      enrich(contacts.incoming || []),
    ]);

    const incoming = incomingEnriched;

    return { confirmed: confirmedEnriched, pending: pendingEnriched, incoming };
  } catch (error) {
    console.error("❌ Error cargando contactos:", error);
    return { confirmed: [], pending: [], incoming: [] };
  }
}
