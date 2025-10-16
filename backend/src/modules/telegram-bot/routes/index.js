// src/modules/telegram-bot/routes/index.js
// Rutas para administrar el bot de Telegram

import { Router } from 'express';
import logger from '../../../config/logger.js';
import { listTokens } from '../services/tokenCatalog.service.js';

const router = Router();

/**
 * GET /api/v1/telegram-bot/stats
 * Obtiene estadísticas del bot
 */
router.get('/stats', async (req, res) => {
  try {
    // Importar dinámicamente para evitar errores si no está configurado
    const { getTelegramBotStats } = await import('../index.js');
    const stats = getTelegramBotStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('❌ [telegram-bot] Error getting stats', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Telegram bot not configured or failed to get stats'
    });
  }
});

/**
 * POST /api/v1/telegram-bot/start
 * Inicia el bot de Telegram
 */
router.post('/start', async (req, res) => {
  try {
    // Importar dinámicamente para evitar errores si no está configurado
    const { startTelegramBot } = await import('../index.js');
    await startTelegramBot();
    
    res.json({
      success: true,
      message: 'Telegram bot started successfully'
    });
    
  } catch (error) {
    logger.error('❌ [telegram-bot] Error starting bot', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to start bot: ' + error.message
    });
  }
});

/**
 * POST /api/v1/telegram-bot/stop
 * Detiene el bot de Telegram
 */
router.post('/stop', async (req, res) => {
  try {
    // Importar dinámicamente para evitar errores si no está configurado
    const { stopTelegramBot } = await import('../index.js');
    await stopTelegramBot();
    
    res.json({
      success: true,
      message: 'Telegram bot stopped successfully'
    });
    
  } catch (error) {
    logger.error('❌ [telegram-bot] Error stopping bot', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to stop bot: ' + error.message
    });
  }
});

/**
 * POST /api/v1/telegram-bot/webhook
 * Webhook para recibir actualizaciones de Telegram
 * (Opcional - para usar webhooks en lugar de polling)
 */
router.post('/webhook', async (req, res) => {
  try {
    // Por ahora usamos polling, pero esta ruta está preparada
    // para implementar webhooks en el futuro si es necesario
    
    res.json({
      success: true,
      message: 'Webhook received (not implemented yet)'
    });
    
  } catch (error) {
    logger.error('❌ [telegram-bot] Error handling webhook', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to handle webhook'
    });
  }
});

/**
 * GET /api/v1/telegram-bot/tokens
 * Obtiene el catálogo de tokens disponible para el bot
 */
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await listTokens();
    res.json({
      success: true,
      count: tokens.length,
      tokens,
    });
  } catch (error) {
    logger.error('❌ [telegram-bot] Error listing tokens', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to load telegram tokens',
    });
  }
});

export default router;



