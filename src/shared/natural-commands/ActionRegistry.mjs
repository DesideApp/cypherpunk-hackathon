// 🤖 GENERADO AUTOMÁTICAMENTE - NO EDITAR MANUALMENTE
// Ejecuta: npm run generate-intents para regenerar

import ActionDefinitions from './ActionDefinitions.mjs';
import { PatternGenerator } from './PatternGenerator.mjs';

const patternGenerator = new PatternGenerator();

export const ACTION_REGISTRY = {};

ActionDefinitions.forEach(actionDef => {
  const patterns = patternGenerator.generate(actionDef);
  
  ACTION_REGISTRY[actionDef.key] = {
    patterns,
    handler: actionDef.handler,
    requiredParams: actionDef.patterns,
    optionalParams: actionDef.optionalParams || [],
    description: actionDef.description,
    examples: actionDef.examples
  };
});

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