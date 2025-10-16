// Simple token metadata for Buy modal and future cards
// Icons are expected under public/tokens/<lower>.png

import { generateTokenColors } from './tokenColorExtractor.js';

// Cache for generated colors to avoid re-processing
const colorCache = new Map();

const META = {
  BONK: {
    code: 'BONK',
    label: 'Bonk',
    icon: '/tokens/bonk.png',
    tint: '#ff9f1a',
    background: '#2c1608',
    glow: 'rgba(255,159,26,0.32)',
    iconScale: 0.88,
  },
  JUP: {
    code: 'JUP',
    label: 'Jupiter',
    icon: '/tokens/jup.png',
    tint: '#2ed47a',
    background: '#0f2118',
    glow: 'rgba(46,212,122,0.28)',
    iconScale: 0.84,
  },
  PENGU: {
    code: 'PENGU',
    label: 'Pudgy Penguins',
    icon: '/tokens/pengu.png',
    tint: '#5cc8f8',
    background: '#0c1d2d',
    glow: 'rgba(92,200,248,0.32)',
    iconScale: 0.9,
  },
  PUMP: {
    code: 'PUMP',
    label: 'Pump',
    icon: '/tokens/pump.png',
    tint: '#62f5a6',
    background: '#0d261a',
    glow: 'rgba(98,245,166,0.3)',
    iconScale: 0.87,
  },
};

export async function getTokenMeta(code) {
  const key = String(code || '').toUpperCase();
  
  // Return predefined metadata if available
  if (META[key]) {
    return META[key];
  }
  
  // Generate automatic colors for unknown tokens
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
    
    // Fallback to default colors
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
  return Object.values(META);
}
