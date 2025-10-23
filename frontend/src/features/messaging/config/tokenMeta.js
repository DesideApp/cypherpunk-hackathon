// Token metadata orchestrator
// 3-layer system: Premium → Auto-extracted → Fallback

import { generateTokenColors } from './tokenColorExtractor.js';
import { getPremiumToken, listPremiumTokens } from './premiumTokens.js';

// Cache for generated colors to avoid re-processing
const colorCache = new Map();

export async function getTokenMeta(code) {
  const key = String(code || '').toUpperCase();
  
  // 🎨 LAYER 1: Check premium tokens first (hardcoded partnerships/special effects)
  const premiumToken = getPremiumToken(key);
  if (premiumToken) {
    return premiumToken;
  }
  
  // 🤖 LAYER 2: Generate automatic colors for unknown tokens
  const iconPath = `/tokens/${key.toLowerCase()}.png`;
  const cacheKey = `${key}_${iconPath}`;
  
  // Check cache first
  if (colorCache.has(cacheKey)) {
    return {
      code: key,
      label: key,
      icon: iconPath,
      ...colorCache.get(cacheKey),
      iconScale: 0.86,
    };
  }
  
  try {
    // Generate colors from logo
    const colors = await generateTokenColors(key, iconPath);
    colorCache.set(cacheKey, colors);
    
    return {
      code: key,
      label: key,
      icon: iconPath,
      ...colors,
      iconScale: 0.86,
    };
  } catch (error) {
    console.warn('Failed to generate colors for token:', key, error);
    
    // 🪙 LAYER 3: Fallback to default colors
    const fallback = {
      tint: '#64748b',
      background: 'rgba(148,163,184,0.08)',
      glow: 'rgba(148,163,184,0.18)',
    };
    
    colorCache.set(cacheKey, fallback);
    
    return {
      code: key,
      label: key,
      icon: iconPath,
      ...fallback,
      iconScale: 0.86,
    };
  }
}

export function listKnownTokens() {
  return listPremiumTokens();
}
