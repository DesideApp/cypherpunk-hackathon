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
 * Activate a token for tracking (lazy loading)
 * Should be called when user selects/interacts with a token
 * @param {string} mint - Token mint address
 * @param {string} code - Token code (e.g., 'BONK', 'SOL')
 * @param {string} userPubkey - User's public key
 * @returns {Promise<{success: boolean, isActive: boolean, wasAlreadyActive: boolean}>}
 */
export async function activateToken(mint, code, userPubkey = null) {
  try {
    if (!mint) {
      return { success: false, isActive: false, wasAlreadyActive: false };
    }

    const url = apiUrl('/api/v1/tokens/activate');
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'  
      },
      credentials: 'include',
      body: JSON.stringify({ mint, code, userPubkey })
    });

    if (!res.ok) {
      console.warn('[priceService] Failed to activate token', {
        mint,
        status: res.status
      });
      return { success: false, isActive: false, wasAlreadyActive: false };
    }

    const result = await res.json();
    
    console.log('[priceService] Token activated', {
      mint,
      code,
      wasAlreadyActive: result.wasAlreadyActive
    });

    return {
      success: result.success || false,
      isActive: result.isActive || false,
      wasAlreadyActive: result.wasAlreadyActive || false,
      activatedAt: result.activatedAt
    };
  } catch (error) {
    console.error('[priceService] Error activating token', {
      mint,
      error: error.message
    });
    return { success: false, isActive: false, wasAlreadyActive: false };
  }
}

/**
 * Check if a token is activated for tracking
 * @param {string} mint - Token mint address
 * @returns {Promise<{success: boolean, isActive: boolean}>}
 */
export async function checkTokenStatus(mint) {
  try {
    if (!mint) {
      return { success: false, isActive: false };
    }

    const url = apiUrl(`/api/v1/tokens/${encodeURIComponent(mint)}/status`);
    
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });

    if (!res.ok) {
      return { success: false, isActive: false };
    }

    const result = await res.json();
    
    return {
      success: result.success || false,
      isActive: result.isActive || false,
      message: result.message
    };
  } catch (error) {
    console.error('[priceService] Error checking token status', {
      mint,
      error: error.message
    });
    return { success: false, isActive: false };
  }
}

/**
 * Fetch historical price data for a token via backend
 * Uses Dialect Markets API (protected by backend)
 * Note: Token must be activated first via activateToken()
 * @param {string} mint - Token mint address
 * @param {string} walletAddress - Optional wallet address for position-based history
 * @param {number} points - Number of data points (default: 48 for 24h)
 * @param {string} resolution - Time interval: '1m', '5m', '1h', '1d' (default: '1h')
 * @returns {Promise<{success: boolean, data: number[], points: number, isTokenActive: boolean}>}
 */
export async function fetchTokenHistory(mint, walletAddress = null, points = 48, resolution = '1h') {
  if (!mint) throw new Error('mint is required');

  const params = new URLSearchParams({
    resolution,
    points: points.toString()
  });

  if (walletAddress) params.append('walletAddress', walletAddress);

  const url = apiUrl(`/api/v1/tokens/${encodeURIComponent(mint)}/history?${params.toString()}`);
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    credentials: 'include'
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`history request failed (${res.status}): ${body.slice(0, 160)}`);
  }

  const result = await res.json();
  if (!result || result.success === false) {
    throw new Error(result?.message || 'history response error');
  }

  if (!Array.isArray(result.data)) {
    throw new Error('history payload missing data');
  }

  return {
    data: result.data,
    points: result.points || result.data.length,
    source: result.source || null,
  };
}
