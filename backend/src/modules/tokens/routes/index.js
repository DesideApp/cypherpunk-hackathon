// backend/src/modules/tokens/routes/index.js
import { Router } from 'express';
import { getAllowedTokens, getTokenByCode } from '../services/tokenService.js';
import addTokenRoutes from './addToken.js';

const router = Router();

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

