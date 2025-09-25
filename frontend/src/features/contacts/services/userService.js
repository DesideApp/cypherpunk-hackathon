import { apiRequest } from "@shared/services/apiService.js";

const userCache = new Map();

/**
 * 🔍 Busca un usuario por su pubkey
 */
export async function searchUserByPubkey(pubkey) {
  if (!pubkey) {
    return { error: true, message: "Pubkey requerida." };
  }

  if (!/^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(pubkey)) {
    return { error: true, message: "Pubkey inválida." };
  }

  // Cache de 2 minutos para evitar consultas repetidas
  if (userCache.has(pubkey)) {
    const cached = userCache.get(pubkey);
    if (Date.now() - cached.timestamp < 2 * 60 * 1000) {
      return cached.data;
    }
    userCache.delete(pubkey);
  }

  const response = await apiRequest(`/api/users/${pubkey}`, { method: "GET" });

  if (response?.error) {
    return { error: true, message: response.message || "Error consultando usuario." };
  }

  const data =
    response?.registered === false
      ? {
          error: false,
          registered: false,
          pubkey: null,
          relationship: "none",
          blocked: false,
          nickname: null,
          avatar: null,
          message: "Usuario no registrado.",
        }
      : {
          error: false,
          registered: true,
          pubkey: response.pubkey,
          relationship: response.relationship || "none",
          blocked: response.blocked || false,
          nickname: response.nickname || null,
          avatar: response.avatar || null,
          message: null,
        };

  // Guardar en cache
  userCache.set(pubkey, { data, timestamp: Date.now() });

  return data;
}
