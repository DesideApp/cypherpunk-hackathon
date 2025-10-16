// src/modules/telegram-bot/index.js
// Punto de entrada para el módulo de Telegram Bot

import TelegramBot from './controllers/telegramBot.controller.js';
import logger from '../../config/logger.js';

// Instancia singleton del bot
let botInstance = null;

/**
 * Inicializa y obtiene la instancia del bot de Telegram
 */
export async function initializeTelegramBot() {
  if (botInstance) {
    logger.warn('⚠️ [telegram-bot] Bot already initialized');
    return botInstance;
  }

  try {
    botInstance = new TelegramBot();
    await botInstance.initialize();
    
    logger.info('✅ [telegram-bot] Bot initialized successfully');
    return botInstance;
    
  } catch (error) {
    logger.error('❌ [telegram-bot] Failed to initialize bot', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Inicia el bot de Telegram
 */
export async function startTelegramBot() {
  if (!botInstance) {
    await initializeTelegramBot();
  }

  await botInstance.start();
  return botInstance;
}

/**
 * Detiene el bot de Telegram
 */
export async function stopTelegramBot() {
  if (botInstance) {
    await botInstance.stop();
  }
}

/**
 * Obtiene la instancia actual del bot
 */
export function getTelegramBot() {
  return botInstance;
}

/**
 * Obtiene estadísticas del bot
 */
export function getTelegramBotStats() {
  if (!botInstance) {
    return { isRunning: false, activeUsers: 0, totalSessions: 0 };
  }
  
  return botInstance.getStats();
}

export { TelegramBot };
export default {
  initializeTelegramBot,
  startTelegramBot,
  stopTelegramBot,
  getTelegramBot,
  getTelegramBotStats
};





