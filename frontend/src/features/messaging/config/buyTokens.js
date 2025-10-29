/**
 * Token metadata for Buy/Send/Request flows
 * 
 * ⚠️ IMPORTANT: This file does NOT define which tokens are available.
 * Token availability is determined by backend/config/tokens.json
 * 
 * This file only provides:
 * - Jupiter Dial paths for direct swaps
 * - Default decimals (fallback if backend doesn't provide them)
 * - Mint addresses (for compatibility)
 */

const WSOL_MINT = "So11111111111111111111111111111111111111112";

function readEnv(key, fallback = null) {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && key in import.meta.env) {
      const v = import.meta.env[key];
      if (v !== undefined) return v;
    }
  } catch (_) {}
  if (typeof window !== "undefined" && window.__ENV__ && key in window.__ENV__) {
    const v = window.__ENV__[key];
    if (v !== undefined) return v;
  }
  if (typeof process !== "undefined" && process.env && key in process.env) {
    const v = process.env[key];
    if (v !== undefined) return v;
  }
  return fallback;
}

/**
 * Token metadata map
 * Only used to enrich tokens from backend with additional UI metadata
 */
export const TOKEN_METADATA = {
  SOL: {
    dialPath: null, // SOL no necesita swap, es nativo
    decimals: 9,
    mintMainnet: WSOL_MINT,
  },
  BONK: {
    dialPath: "swap/SOL-BONK",
    decimals: 5,
    mintMainnet: readEnv("VITE_MINT_BONK", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"),
  },
  JUP: {
    dialPath: "swap/SOL-JUP",
    decimals: 6,
    mintMainnet: readEnv("VITE_MINT_JUP", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"),
  },
  USDC: {
    dialPath: "swap/SOL-USDC",
    decimals: 6,
    mintMainnet: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  USDT: {
    dialPath: "swap/SOL-USDT",
    decimals: 6,
    mintMainnet: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
  JitoSOL: {
    dialPath: "swap/SOL-JitoSOL",
    decimals: 9,
    mintMainnet: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  },
  POPCAT: {
    dialPath: "swap/SOL-POPCAT",
    decimals: 9,
    mintMainnet: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  },
  ORCA: {
    dialPath: "swap/SOL-ORCA",
    decimals: 6,
    mintMainnet: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  },
};

/**
 * Get metadata for a specific token
 * @param {string} code - Token code (e.g., "SOL", "BONK")
 * @returns {object|null} Token metadata or null if not found
 */
export function getTokenMetadata(code) {
  return TOKEN_METADATA[code] || null;
}

/**
 * Enrich a backend token with UI metadata
 * @param {object} token - Token from backend
 * @returns {object} Enriched token
 */
export function enrichTokenWithMetadata(token) {
  const metadata = getTokenMetadata(token.code);
  
  return {
    code: token.code,
    label: token.label || token.code,
    outputMint: token.mint || metadata?.mintMainnet || null,
    decimals: token.decimals ?? metadata?.decimals ?? 9,
    dialToUrl: metadata?.dialPath ? `https://jupiter.dial.to/${metadata.dialPath}` : null,
    maxAmount: token.maxAmount,
    minAmount: token.minAmount,
    verified: token.verified || false,
    history: Array.isArray(token.history) ? token.history : [],
    historySource: token.historySource || null,
    historyPoints: token.historyPoints || 0,
  };
}

export const INPUT_MINT = WSOL_MINT;
