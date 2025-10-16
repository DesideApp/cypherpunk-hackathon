// backend/src/modules/telegram-bot/test-config.js
// Configuración de prueba para el bot de Telegram

import logger from '#config/logger.js';

/**
 * Configuración de prueba para desarrollo
 * Solo usar en desarrollo, nunca en producción
 */

// Token de prueba (no válido, solo para testing)
const TEST_TOKEN = '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-TEST-TOKEN';

/**
 * Configura el bot para modo de prueba
 */
export function setupTestConfig() {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('⚠️ [telegram-bot] Test config should not be used in production');
    return false;
  }

  // Configurar variables de entorno de prueba
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    process.env.TELEGRAM_BOT_TOKEN = TEST_TOKEN;
    logger.info('🧪 [telegram-bot] Using test token for development');
  }

  return true;
}

/**
 * Simula respuestas del bot para testing
 */
export function createMockBot() {
  return {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    isRunning: false,
    getStats: () => ({
      isRunning: false,
      activeUsers: 0,
      totalSessions: 0,
      mode: 'test'
    })
  };
}

/**
 * Comandos de prueba para el bot
 */
export const TEST_COMMANDS = [
  {
    input: 'envíame 5 SOL por pizza',
    expected: 'request',
    description: 'Solicitud con motivo'
  },
  {
    input: 'mándame 10 USDC',
    expected: 'request',
    description: 'Solicitud simple'
  },
  {
    input: 'send me 2 SOL for dinner',
    expected: 'request',
    description: 'Comando en inglés'
  },
  {
    input: 'pide 1 SOL por café',
    expected: 'request',
    description: 'Solicitud alternativa'
  },
  {
    input: 'envía 2 SOL a 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU por café',
    expected: 'send',
    description: 'Envío en español con memo'
  },
  {
    input: 'send 0.5 USDC to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    expected: 'send',
    description: 'Envío en inglés'
  },
  {
    input: 'buy 1 JUP',
    expected: 'buy',
    description: 'Compra en inglés'
  }
];

/**
 * Ejecuta tests básicos del parser
 */
export function runBasicTests() {
  console.log('🧪 [telegram-bot] Running basic tests...');
  
  try {
    const REQUEST_REGEX = /(?:env[ií]ame|mandame|m[aá]ndame|pide|solicita|necesito|send me|request|quiero)\s+\d+(?:\.\d+)?/i;
    const SEND_REGEX = /(?:env[ií]a|manda|m[aá]nda|transfiere|send|transfer)\s+\d+(?:\.\d+)?\s*(?:sol|usdc|usdt)?\s+(?:a|to)\s+[1-9A-HJ-NP-Za-km-z]{32,44}/i;
    const BUY_REGEX = /(?:compra|cómprame|quiero comprar|buy)\s+\d+(?:\.\d+)?\s+[a-z0-9]+/i;

    // Tests básicos sin imports complejos
    let passed = 0;
    let total = TEST_COMMANDS.length;
    
    TEST_COMMANDS.forEach((test, index) => {
      let detected = null;
      if (BUY_REGEX.test(test.input)) {
        detected = 'buy';
      } else if (SEND_REGEX.test(test.input)) {
        detected = 'send';
      } else if (REQUEST_REGEX.test(test.input)) {
        detected = 'request';
      }
      
      if (detected === test.expected) {
        console.log(`✅ Test ${index + 1}: ${test.description}`);
        passed++;
      } else {
        console.log(`❌ Test ${index + 1}: ${test.description} - Expected ${test.expected}, got ${detected || 'null'}`);
      }
    });
    
    console.log(`🧪 [telegram-bot] Tests completed: ${passed}/${total} passed`);
    
  } catch (error) {
    console.error('❌ [telegram-bot] Test failed', error.message);
  }
}

export default {
  setupTestConfig,
  createMockBot,
  TEST_COMMANDS,
  runBasicTests
};
