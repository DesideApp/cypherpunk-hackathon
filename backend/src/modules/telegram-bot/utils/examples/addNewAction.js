// backend/src/modules/telegram-bot/examples/addNewAction.js
// Ejemplo de cómo añadir una nueva acción al bot

import { registerAction } from '#features/messaging/actions/actions-registry.js';
import logger from '#config/logger.js';

/**
 * Ejemplo: Añadir acción de intercambio (swap)
 * 
 * Este ejemplo muestra cómo extender el bot con nuevas acciones
 * siguiendo la estructura modular existente.
 */

// 1. Definir la nueva acción
const swapAction = {
  key: 'swap',
  patterns: [
    // Patrones en español
    /^(?:cambia|swap|intercambia)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?\s+(?:por|to)\s+(sol|usdc|usdt)/i,
    /^(?:convierte|convert)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?\s+(?:a|to)\s+(sol|usdc|usdt)/i,
    
    // Patrones en inglés
    /^(?:swap|exchange)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?\s+(?:to|for)\s+(sol|usdc|usdt)/i,
  ],
  handler: async (matches, context) => {
    const [, amount, fromToken = 'SOL', toToken] = matches;
    
    // Validar tokens
    if (fromToken.toUpperCase() === toToken.toUpperCase()) {
      throw new Error('No puedes intercambiar el mismo token');
    }
    
    // Construir URL de Jupiter para el swap
    const jupiterUrl = `https://jup.ag/swap?inputMint=${fromToken.toUpperCase()}&outputMint=${toToken.toUpperCase()}&amount=${amount}`;
    
    return {
      token: fromToken.toUpperCase(),
      amount: amount,
      fromToken: fromToken.toUpperCase(),
      toToken: toToken.toUpperCase(),
      actionUrl: jupiterUrl,
      dialToUrl: jupiterUrl,
      type: 'swap'
    };
  },
  description: 'Intercambia tokens: "cambia 5 SOL por USDC" o "swap 10 USDC to SOL"'
};

// 2. Registrar la nueva acción
export function registerSwapAction() {
  try {
    registerAction('swap', swapAction);
    logger.info('✅ [telegram-bot] Swap action registered successfully');
    return true;
  } catch (error) {
    logger.error('❌ [telegram-bot] Failed to register swap action', {
      error: error.message
    });
    return false;
  }
}

// 3. Handler para el bot de Telegram
export function createSwapHandler() {
  return async function handleSwapAction(ctx, actionResult, feeInfo) {
    const { fromToken, toToken, amount, dialToUrl } = actionResult;
    
    let message = `
🔄 *Acción de intercambio creada*

💰 *Detalles:*
• De: ${amount} ${fromToken}
• A: ${toToken}
`;

    // Añadir información del fee si existe
    if (feeInfo) {
      message += `• Fee: ${feeInfo.amount} ${feeInfo.token}
`;
    }

    message += `
🔗 *Enlace de intercambio:* [Hacer swap](${dialToUrl})

💡 *Instrucciones:*
1. Haz clic en el enlace de arriba
2. Confirma el intercambio en tu wallet
3. Los tokens se intercambiarán automáticamente
    `;

    ctx.reply(message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  };
}

/**
 * Ejemplo de uso:
 * 
 * 1. Importar y registrar la acción:
 *    import { registerSwapAction } from './examples/addNewAction.js';
 *    registerSwapAction();
 * 
 * 2. Añadir el handler al bot:
 *    import { createSwapHandler } from './examples/addNewAction.js';
 *    const handleSwapAction = createSwapHandler();
 * 
 * 3. Registrar en handleActionResult:
 *    case 'swap':
 *      await this.handleSwapAction(ctx, actionWithFee, feeInfo);
 *      break;
 */

export default {
  registerSwapAction,
  createSwapHandler
};





