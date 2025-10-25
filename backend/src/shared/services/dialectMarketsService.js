// Dialect Markets API - Historical Position Data
// https://docs.dialect.to/documentation/markets-api/historical-position-data

import { env } from '#config/env.js';
import logger from '#config/logger.js';

const DIALECT_MARKETS_API = 'https://markets.dial.to/api/v0';

/**
 * Fetch historical price data for a token position
 * @param {string} walletAddress - Wallet address to fetch history for
 * @param {string} startTime - Start time (RFC 3339, e.g., '2025-10-08T00:00:00Z')
 * @param {string} endTime - End time (RFC 3339, e.g., '2025-10-10T23:59:59Z')
 * @param {string[]} positionIds - Optional array of position IDs to filter
 * @param {string} resolution - Time interval: '1m', '5m', '1h', '1d'
 * @returns {Promise<Object>} Historical position data
 */
export async function fetchPositionHistory({
  walletAddress,
  startTime,
  endTime,
  positionIds = [],
  resolution = '1h'
}) {
  try {
    const params = new URLSearchParams({
      walletAddress,
      startTime,
      endTime,
      resolution
    });

    // Add position IDs if provided
    if (positionIds && positionIds.length > 0) {
      positionIds.forEach(id => params.append('positionIds[]', id));
    }

    const url = `${DIALECT_MARKETS_API}/positions/history?${params.toString()}`;
    
    const headers = {
      'Accept': 'application/json',
    };

    // Add API key if available
    if (env.DIALECT_BLINK_CLIENT_KEY) {
      headers['x-dialect-api-key'] = env.DIALECT_BLINK_CLIENT_KEY;
    }

    logger.debug('[dialectMarketsService] Fetching position history', {
      walletAddress,
      startTime,
      endTime,
      resolution,
      positionCount: positionIds.length
    });

    const response = await fetch(url, { headers });

    if (!response.ok) {
      logger.warn('[dialectMarketsService] API returned error', {
        status: response.status,
        statusText: response.statusText
      });
      return { data: { positions: [] } };
    }

    const data = await response.json();
    
    logger.info('[dialectMarketsService] Position history fetched', {
      positionCount: data?.data?.positions?.length || 0
    });

    return data;
  } catch (error) {
    logger.error('[dialectMarketsService] Failed to fetch position history', {
      error: error.message
    });
    return { data: { positions: [] } };
  }
}

/**
 * Extract price history for a specific token from position data
 * Useful for generating sparkline charts
 * @param {Object} positionData - Response from fetchPositionHistory
 * @param {string} tokenSymbol - Token symbol to filter (e.g., 'BONK', 'SOL')
 * @returns {Array<{timestamp: string, price: number}>} Price history points
 */
export function extractTokenPriceHistory(positionData, tokenSymbol) {
  try {
    if (!positionData?.data?.positions) {
      return [];
    }

    // Find positions matching the token symbol
    const matchingPositions = positionData.data.positions.filter(position => {
      const marketId = position.marketId?.toLowerCase() || '';
      const providerId = position.providerId?.toLowerCase() || '';
      const token = tokenSymbol.toLowerCase();
      
      return marketId.includes(token) || providerId.includes(token);
    });

    if (matchingPositions.length === 0) {
      return [];
    }

    // Combine all history points from matching positions
    const allPoints = [];
    
    matchingPositions.forEach(position => {
      if (position.history && Array.isArray(position.history)) {
        position.history.forEach(snapshot => {
          if (snapshot.timestamp && typeof snapshot.amountUsd === 'number') {
            allPoints.push({
              timestamp: snapshot.timestamp,
              price: snapshot.amountUsd
            });
          }
        });
      }
    });

    // Sort by timestamp
    allPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return allPoints;
  } catch (error) {
    logger.error('[dialectMarketsService] Failed to extract token price history', {
      error: error.message,
      tokenSymbol
    });
    return [];
  }
}

/**
 * Get simplified price history for a token (last 24h)
 * Returns normalized price points suitable for sparkline charts
 * @param {string} mintAddress - Token mint address (can be used to lookup wallet positions)
 * @param {number} points - Number of data points to return (default: 48)
 * @returns {Promise<number[]>} Array of normalized price values
 */
export async function getTokenPriceHistory24h(mintAddress, points = 48) {
  try {
    // For now, we'll need to enhance this to map mint addresses to position tracking
    // This is a placeholder that returns empty array
    // Real implementation would:
    // 1. Query positions API to find positions for this mint
    // 2. Fetch history for last 24h
    // 3. Normalize to requested number of points
    
    logger.debug('[dialectMarketsService] Token price history 24h requested', {
      mintAddress,
      points
    });

    // TODO: Implement when we have wallet address mapping
    return [];
  } catch (error) {
    logger.error('[dialectMarketsService] Failed to get token price history 24h', {
      error: error.message,
      mintAddress
    });
    return [];
  }
}

