// backend/src/modules/tokens/routes/addToken.js
import { Router } from 'express';
import { addTokenToConfig } from '../services/tokenService.js';
import { validateTokenComplete } from '../../../../../ai-token-agent/src/jupiterValidator.js';
import { calculateMaxAmount } from '../../../../../ai-token-agent/src/codeGenerator.js';
import logger from '#config/logger.js';
import logEvent from '#modules/stats/services/eventLogger.service.js';

const router = Router();

/**
 * POST /api/v1/tokens/search
 * Busca un token por código en Jupiter
 */
router.post('/search', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'CODE_REQUIRED',
        message: 'Token code is required',
      });
    }
    
    // Buscar en Jupiter Token List (búsqueda parcial)
    const { findTokenBySymbolPartial } = await import('../../../../../ai-token-agent/src/jupiterValidator.js');
    const result = await findTokenBySymbolPartial(code);
    
    if (!result.found) {
      return res.status(404).json({
        success: false,
        error: 'TOKEN_NOT_FOUND',
        message: `Token ${code} not found in Jupiter`,
      });
    }
    
    if (result.multiple) {
      // Obtener precios para todos los tokens
      const tokensWithPrices = await Promise.all(
        result.tokens.map(async (token) => {
          try {
            const { getTokenPrice } = await import('../../../../../ai-token-agent/src/jupiterValidator.js');
            const priceInfo = await getTokenPrice(token.mint);
            return {
              ...token,
              price: priceInfo.price || null,
            };
          } catch (error) {
            return {
              ...token,
              price: null,
            };
          }
        })
      );
      
      return res.status(200).json({
        success: true,
        found: true,
        multiple: true,
        tokens: tokensWithPrices.map((token) => ({
          ...token,
          code: token.symbol,
          label: token.name,
        })),
      });
    }
    
    // Token único - obtener precio
    let price = null;
    try {
      const { getTokenPrice } = await import('../../../../../ai-token-agent/src/jupiterValidator.js');
      const priceInfo = await getTokenPrice(result.token.address);
      price = priceInfo.price || null;
    } catch (error) {
      // Precio no disponible
    }
    
    return res.status(200).json({
      success: true,
      found: true,
      multiple: false,
      token: {
        mint: result.token.address,
        code: result.token.symbol,
        label: result.token.name,
        decimals: result.token.decimals,
        logoURI: result.token.logoURI,
        verified: result.token.extensions?.coingeckoId ? true : false,
        price: price,
      },
    });
    
  } catch (error) {
    logger.error('❌ [tokens] Error searching token', { 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'SEARCH_TOKEN_FAILED',
      message: 'Failed to search token',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/tokens/add
 * Añade un token usando el AI Agent completo (unificado)
 */
router.post('/add', async (req, res) => {
  try {
    const { mint, code } = req.body;
    const wallet = req.user?.wallet || req.user?.id;
    
    if (!mint || typeof mint !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'MINT_REQUIRED',
        message: 'Contract address (mint) is required',
      });
    }
    
    logger.info('🤖 [tokens] AI Agent adding token (unified system)', { mint });
    
    // Importar el AI Agent completo
    const { addTokenOrchestrated } = await import('../../../../../ai-token-agent/src/orchestrator.js');
    
    // Usar el AI Agent completo (mismo que CLI)
    const result = await addTokenOrchestrated(mint, {
      code: code || undefined, // Opcional override
      downloadLogo: true,      // Descargar logo automáticamente
      verbose: false,          // No mostrar logs detallados en API
    });
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'TOKEN_ADD_FAILED',
        message: result.reason || 'Failed to add token',
        details: result.errors || [],
      });
    }
    
    logger.info('✅ [tokens] Token added successfully (unified)', { 
      code: result.tokenData?.code,
      label: result.tokenData?.label 
    });
    
    const response = {
      success: true,
      message: `Token ${result.tokenData.code} added successfully`,
      token: {
        code: result.tokenData.code,
        label: result.tokenData.label,
        mint: result.tokenData.mint,
        decimals: result.tokenData.decimals,
        maxAmount: result.tokenData.maxAmount,
        verified: result.tokenData.verified,
      },
      filesUpdated: {
        backend: result.backend?.success || false,
        frontend: result.frontend?.success || false,
        logo: result.logo?.success || false,
      },
    };

    res.status(200).json(response);

    await safeLog(wallet, 'token_added', {
      mint: result.tokenData?.mint,
      code: result.tokenData?.code,
    });
    
  } catch (error) {
    logger.error('❌ [tokens] Error adding token (unified)', {
      error: error.message,
      stack: error.stack 
    });
    
    await safeLog(req.user?.wallet || req.user?.id, 'token_add_failed', {
      mint: req.body?.mint,
      code: req.body?.code,
      message: error.message,
    });
    
    res.status(500).json({
      success: false,
      error: 'ADD_TOKEN_FAILED',
      message: 'Failed to add token',
      details: error.message,
    });
  }
});

export default router;

async function safeLog(userId, eventType, data) {
  try {
    if (!userId) return;
    await logEvent(userId, eventType, data);
  } catch (error) {
    logger.warn('⚠️ [tokens] Failed to log event', { eventType, error: error.message });
  }
}
