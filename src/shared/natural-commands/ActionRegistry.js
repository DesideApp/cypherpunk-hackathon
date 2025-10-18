// 🤖 GENERADO AUTOMÁTICAMENTE - NO EDITAR MANUALMENTE
// Ejecuta: npm run generate-intents para regenerar

import ActionDefinitions from './ActionDefinitions.mjs';

export const ACTION_REGISTRY = {};

ActionDefinitions.forEach(actionDef => {
  const patterns = generatePatterns(actionDef);
  
  ACTION_REGISTRY[actionDef.key] = {
    patterns,
    handler: actionDef.handler,
    requiredParams: actionDef.patterns,
    optionalParams: ['recipient', 'memo'],
    description: actionDef.description
  };
});

function generatePatterns(actionDef) {
  const patterns = [];
  const { verbs, patterns: paramPatterns } = actionDef;
  
  const patternMap = {
    amount: '(\\d+(?:\\.\\d+)?)',
    token: '(SOL|USDC|USDT|BONK|JUP)',
    recipient: '(?:a\\s+@?([a-zA-Z0-9_]+))?',
    fromToken: '(SOL|USDC|USDT|BONK|JUP)',
    toToken: '(?:a|to|en|por)\\s+(SOL|USDC|USDT|BONK|JUP)',
    protocol: '(?:en|in|on|de|from|to)\\s+(kamino|marginfi|jupiter|orca)'
  };
  
  verbs.forEach(verb => {
    let regex = `^${verb}\\s+`;
    
    paramPatterns.forEach((pattern, index) => {
      if (patternMap[pattern]) {
        regex += patternMap[pattern];
      }
      
      if (index < paramPatterns.length - 1) {
        regex += '\\s+';
      }
    });
    
    patterns.push(new RegExp(regex, 'i'));
  });
  
  return patterns;
}

export function isValidToken(token) {
  const validTokens = ['SOL', 'USDC', 'USDT', 'BONK', 'JUP'];
  return validTokens.includes(token.toUpperCase());
}

export function extractMentions(text) {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

export function extractMemo(text) {
  const memoRegex = /(?:por|for|memo|nota|note):\\s*(.+?)(?:\\s|$)/i;
  const match = text.match(memoRegex);
  return match ? match[1].trim() : null;
}