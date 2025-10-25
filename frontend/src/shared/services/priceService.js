import { apiUrl } from '@shared/config/env.js';

// Fetch token prices via Jupiter Price API v3 (Lite)
// ids: array of mint addresses

export async function fetchPrices(ids = []) {
  try {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return {};
    const url = `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(unique.join(','))}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return data || {};
  } catch {
    return {};
  }
}

/**
 * Fetch historical price data for a token via backend
 * Uses Dialect Markets API (protected by backend)
 * @param {string} mint - Token mint address
 * @param {string} walletAddress - Optional wallet address for position-based history
 * @param {number} points - Number of data points (default: 48 for 24h)
 * @param {string} resolution - Time interval: '1m', '5m', '1h', '1d' (default: '1h')
 * @returns {Promise<{success: boolean, data: number[], points: number}>}
 */
export async function fetchTokenHistory(mint, walletAddress = null, points = 48, resolution = '1h') {
  try {
    if (!mint) {
      return { success: false, data: [], points: 0 };
    }

    const params = new URLSearchParams({
      resolution,
      points: points.toString()
    });

    if (walletAddress) {
      params.append('walletAddress', walletAddress);
    }

    const url = apiUrl(`/v1/tokens/${encodeURIComponent(mint)}/history?${params.toString()}`);
    
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'include' // Include cookies for auth if needed
    });

    if (!res.ok) {
      console.warn('[priceService] Failed to fetch token history', {
        mint,
        status: res.status
      });
      return { success: false, data: [], points: 0 };
    }

    const result = await res.json();
    
    return {
      success: result.success || false,
      data: result.data || [],
      points: result.points || 0,
      message: result.message
    };
  } catch (error) {
    console.error('[priceService] Error fetching token history', {
      mint,
      error: error.message
    });
    return { success: false, data: [], points: 0 };
  }
}

