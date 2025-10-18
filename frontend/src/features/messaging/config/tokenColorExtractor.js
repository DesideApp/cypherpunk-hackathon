// Automatic token color extraction from logos
// Generates tint, background, and glow colors for premium effects

/**
 * Extract dominant colors from an image using Canvas API
 * @param {string} imageUrl - URL of the token logo
 * @returns {Promise<{primary: string, secondary: string}>}
 */
export async function extractTokenColors(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize for performance (smaller = faster)
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        
        ctx.drawImage(img, 0, 0, size, size);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;
        
        // Extract colors (skip transparent pixels)
        const colors = [];
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha > 128) { // Only non-transparent pixels
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            colors.push({ r, g, b });
          }
        }
        
        if (colors.length === 0) {
          resolve({ primary: '#64748b', secondary: '#94a3b8' });
          return;
        }
        
        // Find dominant colors using simple clustering
        const primary = findDominantColor(colors);
        const secondary = findSecondaryColor(colors, primary);
        
        resolve({ primary, secondary });
      } catch (error) {
        console.warn('Color extraction failed:', error);
        resolve({ primary: '#64748b', secondary: '#94a3b8' });
      }
    };
    
    img.onerror = () => {
      console.warn('Failed to load image for color extraction:', imageUrl);
      resolve({ primary: '#64748b', secondary: '#94a3b8' });
    };
    
    img.src = imageUrl;
  });
}

/**
 * Find the most dominant color
 */
function findDominantColor(colors) {
  // Simple approach: find the most frequent color
  const colorMap = new Map();
  
  colors.forEach(color => {
    // Quantize colors to reduce noise
    const quantized = {
      r: Math.floor(color.r / 32) * 32,
      g: Math.floor(color.g / 32) * 32,
      b: Math.floor(color.b / 32) * 32
    };
    
    const key = `${quantized.r},${quantized.g},${quantized.b}`;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  });
  
  // Find most frequent
  let maxCount = 0;
  let dominantKey = '';
  
  for (const [key, count] of colorMap) {
    if (count > maxCount) {
      maxCount = count;
      dominantKey = key;
    }
  }
  
  const [r, g, b] = dominantKey.split(',').map(Number);
  return rgbToHex(r, g, b);
}

/**
 * Find a secondary color (complementary or different hue)
 */
function findSecondaryColor(colors, primary) {
  const primaryRgb = hexToRgb(primary);
  
  // Find a color with different hue
  let bestColor = null;
  let maxHueDiff = 0;
  
  colors.forEach(color => {
    const hue = rgbToHue(color.r, color.g, color.b);
    const primaryHue = rgbToHue(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    const hueDiff = Math.abs(hue - primaryHue);
    
    if (hueDiff > maxHueDiff) {
      maxHueDiff = hueDiff;
      bestColor = color;
    }
  });
  
  return bestColor ? rgbToHex(bestColor.r, bestColor.g, bestColor.b) : primary;
}

/**
 * Generate token metadata with automatic colors
 * @param {string} code - Token code
 * @param {string} imageUrl - Token logo URL
 * @returns {Promise<{tint: string, background: string, glow: string}>}
 */
export async function generateTokenColors(code, imageUrl) {
  const { primary, secondary } = await extractTokenColors(imageUrl);
  
  // Generate tint (primary color)
  const tint = primary;
  
  // Generate background (darkened primary)
  const primaryRgb = hexToRgb(primary);
  const backgroundRgb = {
    r: Math.floor(primaryRgb.r * 0.15),
    g: Math.floor(primaryRgb.g * 0.15),
    b: Math.floor(primaryRgb.b * 0.15)
  };
  const background = rgbToHex(backgroundRgb.r, backgroundRgb.g, backgroundRgb.b);
  
  // Generate glow (semi-transparent primary)
  const glowRgb = hexToRgb(primary);
  const glow = `rgba(${glowRgb.r},${glowRgb.g},${glowRgb.b},0.3)`;
  
  return { tint, background, glow };
}

// Utility functions
function rgbToHex(r, g, b) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 100, g: 116, b: 139 }; // fallback to slate-500
}

function rgbToHue(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  if (diff === 0) return 0;
  
  let hue = 0;
  if (max === r) {
    hue = ((g - b) / diff) % 6;
  } else if (max === g) {
    hue = (b - r) / diff + 2;
  } else {
    hue = (r - g) / diff + 4;
  }
  
  return (hue * 60 + 360) % 360;
}







