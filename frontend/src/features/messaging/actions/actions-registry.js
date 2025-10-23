// Registry de acciones disponibles para el parser de comandos naturales
// Estructura modular y extensible

import { buildRequest } from './blinkUrlBuilder.js';

/**
 * Registry de acciones disponibles
 * Cada acción tiene:
 * - key: identificador único
 * - patterns: regex patterns para detectar comandos
 * - handler: función que procesa el comando
 * - description: descripción para ayuda
 */
export const ACTIONS_REGISTRY = {
  request: {
    key: 'request',
    patterns: [
      // Comandos en español
      /^(?:envíame|enviamе|mándame|mandame)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?(?:\s+(?:por|for)\s+(.+))?/i,
      /^(?:pide|solicita|necesito)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?(?:\s+(?:por|for)\s+(.+))?/i,
      
      // Comandos en inglés
      /^(?:send me|request)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?(?:\s+(?:for|por)\s+(.+))?/i,
    ],
    handler: async (matches, context) => {
      const [, amount, token = 'SOL', reason] = matches;
      if (!context.myWallet) {
        throw new Error('Necesitas tener una wallet conectada para hacer requests');
      }
      
      return buildRequest({
        token: token.toUpperCase(),
        amount: amount,
        to: context.myWallet,
        memo: reason || context.memo
      });
    },
    description: 'Solicita tokens: "envíame 5 SOL por pizza" o "mándame 10 USDC"'
  },

  // Placeholder para futuras acciones
  buy: {
    key: 'buy',
    patterns: [
      /^(?:compra|buy|comprar)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?\s+(?:de|of)\s+(.+)/i,
      /^(?:quiero|want)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?\s+(?:de|of)\s+(.+)/i,
    ],
    handler: async (_matches, _context) => {
      // TODO: Implementar cuando tengas la acción buy
      throw new Error('Acción buy no implementada aún');
    },
    description: 'Compra tokens: "compra 1 SOL de BONK" o "quiero 100 USDC de PEPE"'
  }
};

/**
 * Detecta si un texto contiene un comando de acción
 * @param {string} text - Texto a analizar
 * @returns {Object|null} - Información de la acción detectada o null
 */
export function detectAction(text) {
  const trimmedText = text.trim();
  
  for (const [actionKey, action] of Object.entries(ACTIONS_REGISTRY)) {
    for (const pattern of action.patterns) {
      const matches = trimmedText.match(pattern);
      if (matches) {
        return {
          action: actionKey,
          matches,
          pattern,
          handler: action.handler,
          description: action.description
        };
      }
    }
  }
  
  return null;
}

/**
 * Procesa un comando de acción
 * @param {string} text - Texto del comando
 * @param {Object} context - Contexto (peerWallet, myWallet, etc.)
 * @returns {Object} - Resultado de la acción
 */
export async function processAction(text, context = {}) {
  const detected = detectAction(text);
  if (!detected) {
    throw new Error('No se detectó ninguna acción válida');
  }
  
  try {
    const result = await detected.handler(detected.matches, context);
    return {
      success: true,
      action: detected.action,
      result,
      description: detected.description
    };
  } catch (error) {
    return {
      success: false,
      action: detected.action,
      error: error.message,
      description: detected.description
    };
  }
}

/**
 * Obtiene todas las acciones disponibles para mostrar ayuda
 * @returns {Array} - Lista de acciones con sus descripciones
 */
export function getAvailableActions() {
  return Object.entries(ACTIONS_REGISTRY).map(([key, action]) => ({
    key,
    description: action.description
  }));
}

/**
 * Añade una nueva acción al registry
 * @param {string} key - Clave de la acción
 * @param {Object} actionConfig - Configuración de la acción
 */
export function registerAction(key, actionConfig) {
  ACTIONS_REGISTRY[key] = actionConfig;
}

/**
 * Detecta URLs de blinks en el texto
 * @param {string} text - Texto a analizar
 * @returns {Array} - Array de URLs de blinks encontradas
 */
export function detectBlinkUrls(text) {
  const blinkUrlPatterns = [
    /https?:\/\/[^\s]+\.dial\.to\/[^\s]*/gi,
    /https?:\/\/[^\s]*solana\.dial\.to\/[^\s]*/gi,
    /solana-action:[^\s]+/gi,
  ];
  
  const urls = [];
  for (const pattern of blinkUrlPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }
  
  return [...new Set(urls)]; // Remove duplicates
}





