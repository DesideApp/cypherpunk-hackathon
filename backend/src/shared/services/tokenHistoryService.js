// backend/src/shared/services/tokenHistoryService.js
// Helpers to fetch historical price data from Coingecko

import fetch from 'node-fetch';
import logger from '#config/logger.js';
import { env } from '#config/env.js';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_API_KEY = env.COINGECKO_API_KEY || '';
const DEFAULT_DAYS = 1;
const DEFAULT_INTERVAL = 'hourly';

// Static mapping token code -> Coingecko coin id
const COINGECKO_IDS = Object.freeze({
  SOL: 'solana',
  BONK: 'bonk',
  JUP: 'jupiter-exchange-solana',
  JITOSOL: 'jito-staked-sol',
  POPCAT: 'popcat',
  USDC: 'usd-coin',
  USDT: 'tether',
  ORCA: 'orca',
});

/**
 * Fetch price history for a token from Coingecko.
 * @param {Object} params
 * @param {string} params.code - Token code (e.g., 'BONK', 'SOL')
 * @param {number} [params.days=1] - Range in days (1, 7, 30…)
 * @param {string} [params.interval='hourly'] - Coingecko interval ('hourly', 'daily')
 * @param {AbortSignal} [params.signal] - Optional abort signal
 * @returns {Promise<Array<{timestamp:number, price:number}>>}
 */
export async function fetchCoingeckoPriceHistory({
  code,
  days = DEFAULT_DAYS,
  interval = DEFAULT_INTERVAL,
  signal,
} = {}) {
  if (!code) return [];

  const id = COINGECKO_IDS[String(code).toUpperCase()] || null;
  if (!id) {
    logger.debug('[tokenHistoryService] No Coingecko mapping for token code', { code });
    return [];
  }

  const params = new URLSearchParams({
    vs_currency: 'usd',
    days: String(days),
    interval,
  });

  let response;
  try {
    const headers = { Accept: 'application/json' };
    if (COINGECKO_API_KEY) {
      headers['x-cg-pro-api-key'] = COINGECKO_API_KEY;
    }

    response = await fetch(
      `${COINGECKO_BASE_URL}/coins/${encodeURIComponent(id)}/market_chart?${params.toString()}`,
      {
        headers,
        signal,
      },
    );
  } catch (error) {
    logger.warn('[tokenHistoryService] Coingecko price history request failed', {
      code,
      id,
      error: error?.message || String(error),
    });
    logger.warn(`[tokenHistoryService] Coingecko request failed code=${code} id=${id} error=${error?.message || error}`);
    return [];
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '<no-body>');
    logger.warn(`[tokenHistoryService] Coingecko price history responded with error code=${code} id=${id} status=${response.status} body=${text.slice(0, 200)}`);
    return [];
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    logger.warn(`[tokenHistoryService] Coingecko price history invalid JSON code=${code} id=${id} error=${error?.message || error}`);
    return [];
  }

  const pricesArray = Array.isArray(payload?.prices) ? payload.prices : [];
  if (pricesArray.length === 0) return [];

  const history = [];
  for (const tuple of pricesArray) {
    if (!Array.isArray(tuple) || tuple.length < 2) continue;
    const [ts, price] = tuple;
    const priceNum = Number(price);
    const timestamp = Number(ts);
    if (!Number.isFinite(priceNum)) continue;
    history.push({
      price: priceNum,
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    });
  }

  if (history.length === 0) return [];

  history.sort((a, b) => a.timestamp - b.timestamp);
  return history;
}
