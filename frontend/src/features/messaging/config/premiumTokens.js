// Premium token configurations
// Hardcoded metadata for partner tokens and special effects

export const PREMIUM_TOKENS = {
  SOL: {
    code: 'SOL',
    label: 'Solana',
    icon: '/tokens/sol.png',
    // Gradient: Verde azulado → Morado → Fucsia
    gradient: ['#14F195', '#9945FF', '#DC1FFF'],
    primaryColor: '#9945FF', // Morado para efectos estáticos
    tint: '#9945FF',
    background: '#1a0f2e',
    glow: 'rgba(153, 69, 255, 0.35)',
    iconScale: 0.88,
    effects: {
      animated: true,
      gradientBorder: true,
    }
  },

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

/**
 * Get premium token metadata
 * @param {string} code - Token code (case insensitive)
 * @returns {Object|null} Premium metadata or null if not found
 */
export function getPremiumToken(code) {
  const key = String(code || '').toUpperCase();
  return PREMIUM_TOKENS[key] || null;
}

/**
 * Check if a token has premium configuration
 * @param {string} code - Token code
 * @returns {boolean}
 */
export function isPremiumToken(code) {
  const key = String(code || '').toUpperCase();
  return key in PREMIUM_TOKENS;
}

/**
 * List all premium tokens
 * @returns {Array} Array of premium token metadata
 */
export function listPremiumTokens() {
  return Object.values(PREMIUM_TOKENS);
}
