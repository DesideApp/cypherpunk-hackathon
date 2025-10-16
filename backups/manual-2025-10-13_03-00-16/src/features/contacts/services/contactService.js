import { apiRequest } from "@shared/services/apiService.js";

/**
 * 🔹 Obtener contactos (confirmados, pendientes, entrantes)
 */
export async function fetchContacts() {
  try {
    const response = await apiRequest("/api/contacts", { method: "GET" });
    // Ajuste para acceder al nivel `data`
    return response?.data || { confirmed: [], pending: [], incoming: [] };
  } catch {
    return { confirmed: [], pending: [], incoming: [] };
  }
}

/**
 * 🔹 Enviar solicitud de contacto (ya validado en el hook)
 */
export async function sendContactRequest(pubkey) {
  return handleContactAction("/api/contacts/send", "POST", pubkey);
}

/**
 * 🔹 Aceptar solicitud de contacto
 */
export async function approveContact(pubkey) {
  return handleContactAction("/api/contacts/accept", "POST", pubkey);
}

/**
 * 🔹 Rechazar solicitud o eliminar contacto
 */
export async function rejectContact(pubkey) {
  return handleContactAction("/api/contacts/remove", "DELETE", pubkey);
}

/**
 * 🔹 Acción unificada con control de errores
 */
async function handleContactAction(endpoint, method, pubkey) {
  if (!pubkey) {
    return { success: false, error: "Clave pública no proporcionada." };
  }

  try {
    const response = await apiRequest(endpoint, {
      method,
      body: JSON.stringify({ pubkey }),
    });

    if (response?.error || response?.statusCode >= 400) {
      return {
        success: false,
        error: response.message || "Error en la acción de contacto.",
      };
    }

    return { success: true, message: response.message };
  } catch {
    return { success: false, error: "Error en la solicitud." };
  }
}
