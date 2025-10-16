import { apiRequest } from "@shared/services/apiService.js";

/**
 * Solana service: endpoints to fetch status, TPS and price from backend.
 */
export async function getSolanaStatus() {
  try {
    const response = await apiRequest("/api/solana/solana-status", { method: "GET" });
    return response?.status || "offline";
  } catch (error) {
    console.warn("⚠️ Error obteniendo estado de Solana:", error?.message || error);
    return "offline";
  }
}

export async function getSolanaTPS() {
  try {
    const response = await apiRequest("/api/solana/solana-tps", { method: "GET" });
    return typeof response?.tps === "number" ? response.tps : 0;
  } catch (error) {
    console.warn("⚠️ Error obteniendo TPS de Solana:", error?.message || error);
    return 0;
  }
}

export async function getSolanaPrice() {
  try {
    const response = await apiRequest("/api/solana/solana-price", { method: "GET" });
    return typeof response?.price === "number" ? response.price : 0;
  } catch (error) {
    console.warn("⚠️ Error obteniendo precio de SOL:", error?.message || error);
    return 0;
  }
}
