import { apiRequest } from "@shared/services/apiService.js";

const BASE = "/api/v1/tokens";

let cachedTokens = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

function ensureOk(response) {
  if (!response) {
    throw new Error("Failed to fetch allowed tokens without response.");
  }
  if (response.error) {
    const err = new Error(response.message || "Failed to fetch allowed tokens.");
    err.code = response.errorCode || response.error;
    err.details = response.details || null;
    throw err;
  }
  if (response.data) return response.data;
  return response;
}

export async function getAllowedTokens({ useCache = true } = {}) {
  // Verificar cache si está habilitado
  if (useCache && cachedTokens && cacheTimestamp) {
    const now = Date.now();
    if (now - cacheTimestamp < CACHE_DURATION_MS) {
      console.debug("[allowedTokens] using cached tokens", { 
        count: cachedTokens.tokens?.length || 0,
        age: now - cacheTimestamp 
      });
      return cachedTokens;
    }
  }

  try {
    console.debug("[allowedTokens] fetching from backend");
    const res = await apiRequest(`${BASE}/allowed`, {
      method: "GET",
    });
    
    const data = ensureOk(res);
    
    // Actualizar cache
    cachedTokens = data;
    cacheTimestamp = Date.now();
    
    console.debug("[allowedTokens] tokens fetched successfully", {
      count: data.tokens?.length || 0,
      tokens: data.tokens?.map(t => ({ code: t.code, label: t.label })) || []
    });
    
    return data;
  } catch (error) {
    console.error("[allowedTokens] fetch failed", error);
    
    // Si hay cache disponible, usarlo como fallback
    if (cachedTokens) {
      console.warn("[allowedTokens] using stale cache due to fetch error");
      return cachedTokens;
    }
    
    throw error;
  }
}

export function clearAllowedTokensCache() {
  cachedTokens = null;
  cacheTimestamp = null;
  console.debug("[allowedTokens] cache cleared");
}

export function getTokenInfo(tokenCode) {
  if (!cachedTokens?.tokens) return null;
  return cachedTokens.tokens.find(token => token.code === tokenCode) || null;
}

export function isTokenAllowed(tokenCode) {
  const token = getTokenInfo(tokenCode);
  return token && token.mint && token.mint.trim() !== '';
}

