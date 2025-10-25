// backend/src/modules/tokens/routes/index.js
import { Router } from 'express';
import { getAllowedTokens, getTokenByCode } from '../services/tokenService.js';
import { fetchPositionHistory, extractTokenPriceHistory } from '#shared/services/dialectMarketsService.js';
import { 
  activateToken, 
  isTokenActivated, 
  getActivationStats 
} from '../services/tokenActivationService.js';
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
 * POST /api/v1/tokens/activate
 * Activa un token para tracking lazy (solo cuando el usuario lo selecciona)
 * Body: { mint, code, userPubkey }
 */
router.post('/activate', async (req, res) => {
  try {
    const { mint, code, userPubkey } = req.body;

    if (!mint) {
      return res.status(400).json({
        success: false,
        error: 'Mint address required'
      });
    }

    logger.debug('[tokens/activate] Activating token', {
      mint,
      code,
      userPubkey
    });

    const result = activateToken(mint, code, userPubkey || 'anonymous');

    res.status(200).json({
      success: true,
      mint,
      code,
      isActive: true,
      wasAlreadyActive: result.wasAlreadyActive,
      activatedAt: result.activatedAt
    });
  } catch (error) {
    logger.error('[tokens/activate] Failed to activate token', {
      error: error.message,
      mint: req.body?.mint
    });

    res.status(500).json({
      success: false,
      error: 'Failed to activate token',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/tokens/:mint/status
 * Verifica si un token está activo para tracking
 */
router.get('/:mint/status', async (req, res) => {
  try {
    const { mint } = req.params;
    const isActive = isTokenActivated(mint);

    res.status(200).json({
      success: true,
      mint,
      isActive,
      message: isActive 
        ? 'Token is actively tracked' 
        : 'Token is not activated yet'
    });
  } catch (error) {
    logger.error('[tokens/status] Failed to check token status', {
      error: error.message,
      mint: req.params.mint
    });

    res.status(500).json({
      success: false,
      error: 'Failed to check token status',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/tokens/stats/activations
 * Obtiene estadísticas de activaciones (admin/monitoring)
 */
router.get('/stats/activations', async (req, res) => {
  try {
    const stats = getActivationStats();

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('[tokens/stats] Failed to get activation stats', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get activation stats',
      message: error.message
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

    // Check if token is activated (lazy loading)
    const isActive = isTokenActivated(mint);
    
    logger.debug('[tokens/history] Fetching price history', {
      mint,
      walletAddress,
      startTime: start,
      endTime: end,
      resolution,
      isTokenActive: isActive
    });

    // Only fetch from Dialect Markets if token is activated AND wallet provided
    if (walletAddress && isActive) {
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

    // Fallback: Token not activated or no wallet address
    const reason = !isActive 
      ? 'Token not activated yet. Call POST /tokens/activate first.'
      : 'Historical data requires walletAddress parameter';
    
    logger.warn('[tokens/history] Cannot fetch data', {
      mint,
      isActive,
      hasWallet: !!walletAddress,
      reason
    });

    res.status(200).json({
      success: true,
      mint,
      startTime: start,
      endTime: end,
      resolution,
      points: 0,
      data: [],
      isTokenActive: isActive,
      message: reason
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

