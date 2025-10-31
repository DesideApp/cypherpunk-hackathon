// backend/src/shared/services/tokenHistoryService.js
// Real historical prices via CoinGecko Demo API (no mocks)

import fetch from 'node-fetch';
import logger from '#config/logger.js';
import { env } from '#config/env.js';

const COINGECKO_BASE_URL = (env.COINGECKO_API_BASE_URL || 'https://api.coingecko.com/api/v3').replace(/\/+$/, '');
const COINGECKO_API_KEY = env.COINGECKO_API_KEY || '';

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

export async function fetchCoingeckoHistory({ code, days = 1, signal }) {
  if (!code) throw new Error('Token code is required for Coingecko history');
  const id = COINGECKO_IDS[String(code).toUpperCase()];
  if (!id) throw new Error(`No Coingecko mapping for token code ${code}`);

  const params = new URLSearchParams({
    vs_currency: 'usd',
    days: String(days),
  });

  const headers = { Accept: 'application/json' };
  if (COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;

  const url = `${COINGECKO_BASE_URL}/coins/${encodeURIComponent(id)}/market_chart?${params.toString()}`;

  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    const text = await response.text().catch(() => '<no-body>');
    throw new Error(`Coingecko error ${response.status}: ${text.slice(0, 180)}`);
  }

  const payload = await response.json();
  const prices = Array.isArray(payload?.prices) ? payload.prices : [];
  if (!prices.length) throw new Error('Coingecko returned empty price array');

  return prices.map(([timestamp, price]) => ({
    timestamp: Number(timestamp),
    price: Number(price),
  })).filter(p => Number.isFinite(p.price) && Number.isFinite(p.timestamp));
}
