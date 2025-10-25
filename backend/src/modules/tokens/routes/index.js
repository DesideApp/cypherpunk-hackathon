// backend/src/modules/tokens/routes/index.js
import { Router } from 'express';
import { getAllowedTokens, getTokenByCode } from '../services/tokenService.js';
import { fetchPositionHistory, extractTokenPriceHistory } from '#shared/services/dialectMarketsService.js';
import addTokenRoutes from './addToken.js';
import logger from '#config/logger.js';

const router = Router();

/**
 * Normalize price history to a specific number of points
 * @param {Array<{timestamp: string, price: number}>} history - Raw price history
 * @param {number} targetPoints - Desired number of points
 * @returns {Array<number>} Normalized price array
 */
function normalizePricePoints(history, targetPoints) {
  if (!history || history.length === 0) return [];
  if (history.length <= targetPoints) {
    // If we have fewer points than requested, return just the prices
    return history.map(h => h.price);
  }

  // Sample evenly from the history
  const normalized = [];
  const step = history.length / targetPoints;
  
  for (let i = 0; i < targetPoints; i++) {
    const index = Math.floor(i * step);
    normalized.push(history[index].price);
  }

  return normalized;
}

/**
 * GET /api/v1/tokens/allowed
 * Retorna la lista de tokens permitidos para compra
 */
router.get('/allowed', async (req, res) => {
  try {
    const tokens = await getAllowedTokens();
    
    res.status(200).json({
      success: true,
      count: tokens.length,
      tokens: tokens.map(t => ({
        mint: t.mint,
        code: t.code,
        label: t.label,
        decimals: t.decimals,
        maxAmount: t.maxAmount,
        minAmount: t.minAmount,
        verified: t.verified || false,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load allowed tokens',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/tokens/:mint/history
 * Obtiene histórico de precios para un token (últimas 24h)
 * Query params:
 *   - walletAddress: Required if using position-based history
 *   - startTime: Start time (RFC 3339, defaults to 24h ago)
 *   - endTime: End time (RFC 3339, defaults to now)
 *   - resolution: '1m', '5m', '1h', '1d' (defaults to '1h')
 *   - points: Number of points to return (defaults to 48)
 */
router.get('/:mint/history', async (req, res) => {
  try {
    const { mint } = req.params;
    const {
      walletAddress,
      startTime,
      endTime,
      resolution = '1h',
      points = 48
    } = req.query;

    // Default to last 24 hours if not specified
    const end = endTime || new Date().toISOString();
    const start = startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    logger.debug('[tokens/history] Fetching price history', {
      mint,
      walletAddress,
      startTime: start,
      endTime: end,
      resolution
    });

    // If walletAddress provided, fetch position history from Dialect Markets
    if (walletAddress) {
      const positionData = await fetchPositionHistory({
        walletAddress,
        startTime: start,
        endTime: end,
        resolution
      });

      // Extract price points for this token
      const priceHistory = extractTokenPriceHistory(positionData, mint);

      // Normalize to requested number of points
      const normalized = normalizePricePoints(priceHistory, parseInt(points));

      return res.status(200).json({
        success: true,
        mint,
        startTime: start,
        endTime: end,
        resolution,
        points: normalized.length,
        data: normalized
      });
    }

    // Fallback: No wallet address provided
    // Return empty array (client will use synthetic data)
    logger.warn('[tokens/history] No wallet address provided, returning empty', {
      mint
    });

    res.status(200).json({
      success: true,
      mint,
      startTime: start,
      endTime: end,
      resolution,
      points: 0,
      data: [],
      message: 'Historical data requires walletAddress parameter'
    });
  } catch (error) {
    logger.error('[tokens/history] Failed to fetch price history', {
      error: error.message,
      mint: req.params.mint
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch price history',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/tokens/:code
 * Obtiene información de un token específico
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const token = await getTokenByCode(code);
    
    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        code,
      });
    }
    
    res.status(200).json({
      success: true,
      token: {
        mint: token.mint,
        code: token.code,
        label: token.label,
        decimals: token.decimals,
        maxAmount: token.maxAmount,
        minAmount: token.minAmount,
        verified: token.verified || false,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load token',
      message: error.message,
    });
  }
});

// Usar las rutas de addToken
router.use('/', addTokenRoutes);

export default router;

