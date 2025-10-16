// src/modules/natural-commands/actions-registry.js
// Registry de acciones disponibles para comandos naturales

export const ACTION_REGISTRY = {
  send: {
    patterns: [
      /mándame\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /envía\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /te envío\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /quiero enviar\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /send\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i
    ],
    handler: 'createSendAction',
    requiredParams: ['amount', 'token'],
    optionalParams: ['recipient', 'memo'],
    description: 'Enviar tokens a otro usuario'
  },
  
  request: {
    patterns: [
      /pídeme\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /necesito\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /quiero recibir\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /request\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /solicita\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i
    ],
    handler: 'createRequestAction',
    requiredParams: ['amount', 'token'],
    optionalParams: ['memo'],
    description: 'Solicitar tokens de otro usuario'
  },
  
  buy: {
    patterns: [
      /compra\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /quiero comprar\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /buy\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
      /adquiere\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i
    ],
    handler: 'createBuyAction',
    requiredParams: ['amount', 'token'],
    optionalParams: [],
    description: 'Comprar tokens con SOL'
  },
  
  swap: {
    patterns: [
      /cambia\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)\s+a\s+(SOL|USDC|USDT)/i,
      /convierte\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)\s+en\s+(SOL|USDC|USDT)/i,
      /swap\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)\s+to\s+(SOL|USDC|USDT)/i,
      /intercambia\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)\s+por\s+(SOL|USDC|USDT)/i
    ],
    handler: 'createSwapAction',
    requiredParams: ['amount', 'fromToken', 'toToken'],
    optionalParams: [],
    description: 'Intercambiar tokens'
  }
};

// Función helper para validar tokens
export function isValidToken(token) {
  const validTokens = ['SOL', 'USDC', 'USDT'];
  return validTokens.includes(token.toUpperCase());
}

// Función helper para extraer menciones de usuario
export function extractMentions(text) {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

// Función helper para extraer memos/notas
export function extractMemo(text) {
  const memoRegex = /(?:por|for|memo|nota|note):\s*(.+?)(?:\s|$)/i;
  const match = text.match(memoRegex);
  return match ? match[1].trim() : null;
}






