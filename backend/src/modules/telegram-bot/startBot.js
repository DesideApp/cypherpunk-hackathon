#!/usr/bin/env node
// backend/src/modules/telegram-bot/startBot.js
// Script para iniciar el bot de Telegram

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
dotenv.config();

// Configurar imports para el backend
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = join(__dirname, '../..');

// Cambiar al directorio del backend
process.chdir(backendRoot);

// Ahora importar después de cambiar directorio
import { startTelegramBot } from './index.js';
import logger from '../../config/logger.js';

async function main() {
  try {
    logger.info('🚀 [telegram-bot] Starting Telegram Bot...');
    
    // Verificar que existe el token
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }
    
    // Iniciar el bot
    const bot = await startTelegramBot();
    
    logger.info('✅ [telegram-bot] Bot started successfully');
    logger.info('📱 [telegram-bot] Bot is listening for messages...');
    
    // Mantener el proceso vivo
    process.on('SIGINT', async () => {
      logger.info('🛑 [telegram-bot] Received SIGINT, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('🛑 [telegram-bot] Received SIGTERM, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('❌ [telegram-bot] Failed to start bot', {
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  }
}

// Ejecutar solo si es el archivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
