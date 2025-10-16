// src/modules/telegram-bot/services/tokenCatalog.service.js
// Catálogo de tokens para el bot de Telegram (se alimenta de config/tokens.json)

import { env } from '#config/env.js';
import { getAllowedTokens } from '#modules/tokens/services/tokenService.js';

const FALLBACK_TOKENS = [
  { symbol: 'SOL', name: 'Solana', decimals: 9 },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
];

function parseCustomTokens() {
  const raw = env.TELEGRAM_TOKEN_LIST || '';
  if (!raw) return [];

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [symbol, name = symbol] = entry.split(':').map((s) => s.trim());
      return {
        symbol: symbol.toUpperCase(),
        name: name || symbol.toUpperCase(),
        decimals: 6,
        mint: null,
        source: 'custom',
      };
    });
}

function mapAllowedToken(token) {
  return {
    symbol: token.code?.toUpperCase() || token.label || token.mint,
    name: token.label || token.code?.toUpperCase() || token.mint,
    mint: token.mint || null,
    decimals: token.decimals ?? 6,
    minAmount: token.minAmount ?? null,
    maxAmount: token.maxAmount ?? null,
    verified: Boolean(token.verified),
    source: 'config',
  };
}

function dedupeTokens(tokens) {
  const seen = new Set();
  return tokens.filter((token) => {
    const key = token.symbol;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function listTokens() {
  const allowed = await getAllowedTokens();
  let tokens = [];

  if (Array.isArray(allowed) && allowed.length > 0) {
    tokens = allowed.map(mapAllowedToken);
  }

  const custom = parseCustomTokens();

  if (tokens.length === 0) {
    // Fallback a tokens básicos si aún no hay configuración
    tokens = [...FALLBACK_TOKENS];
  } else if (custom.length > 0) {
    tokens = tokens.concat(custom);
  }

  return dedupeTokens(tokens);
}

export async function getToken(symbol) {
  if (!symbol) return null;
  const upper = symbol.trim().toUpperCase();
  const tokens = await listTokens();
  return tokens.find((token) => token.symbol === upper) || null;
}

export default {
  listTokens,
  getToken,
};
