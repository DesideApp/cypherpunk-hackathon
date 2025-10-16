#!/usr/bin/env node
// scripts/test-telegram-bot.mjs
// Script para probar el bot de Telegram sin necesidad de token real

import { runBasicTests } from '../backend/src/modules/telegram-bot/config/testConfig.js';

async function main() {
  console.log('🧪 Probando Bot de Telegram');
  console.log('==========================');
  
  try {
    // Ejecutar tests básicos
    runBasicTests();
    
    // Esperar un poco para que los tests se ejecuten
    setTimeout(() => {
      console.log('');
      console.log('✅ Tests completados');
      console.log('');
      console.log('🚀 Para usar el bot real:');
      console.log('1. Obtén un token de @BotFather en Telegram');
      console.log('2. Añádelo a tu .env: TELEGRAM_BOT_TOKEN=tu_token');
      console.log('3. Ejecuta: npm run telegram:dev');
      console.log('');
      console.log('📖 Más información: backend/src/modules/telegram-bot/README.md');
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error ejecutando tests:', error.message);
    process.exit(1);
  }
}

// Ejecutar solo si es el archivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
