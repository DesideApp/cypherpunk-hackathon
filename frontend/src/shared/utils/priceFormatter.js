/**
 * Format token price with smart decimal precision
 * Shows at least 3 significant digits (non-zero)
 * 
 * Examples:
 * - 1234.56 → "1,234"
 * - 123.456 → "123.46"
 * - 12.3456 → "12.35"
 * - 1.23456 → "1.234"
 * - 0.5678 → "0.568"
 * - 0.000015 → "0.0000150" (BONK)
 * - 0.0000000123 → "0.0000000123"
 * 
 * @param {number} price - Price value
 * @returns {string} Formatted price string
 */
export function formatSmartPrice(price) {
  const num = parseFloat(price);
  
  if (num === 0 || isNaN(num)) return "0";
  
  // Para números >= 1, usar decimales según magnitud
  if (num >= 1000) {
    // 1234.56 → "1,234" (sin decimales, ya tiene 4+ dígitos)
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  }
  
  if (num >= 100) {
    // 123.456 → "123.46" (3 dígitos enteros + 2 decimales = 5 dígitos)
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }
  
  if (num >= 10) {
    // 12.3456 → "12.35" (2 enteros + 2 decimales = 4 dígitos)
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }
  
  if (num >= 1) {
    // 1.23456 → "1.234" (1 entero + 3 decimales = 4 dígitos)
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 3 
    });
  }
  
  // PARA NÚMEROS < 1 (BONK, shitcoins, etc.)
  // Contar cuántos ceros hay después del punto decimal
  const str = num.toString();
  const parts = str.split('.');
  
  if (parts.length < 2) {
    // No tiene parte decimal (edge case)
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 3 
    });
  }
  
  const afterDot = parts[1];
  const leadingZeros = afterDot.match(/^0*/)[0].length;
  
  // Mostrar: todos los ceros + 3 dígitos significativos
  const decimals = leadingZeros + 3;
  
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format price with USD symbol
 * @param {number} price - Price value
 * @returns {string} Formatted price with $ symbol
 */
export function formatPriceUSD(price) {
  if (price == null || isNaN(price)) return "No price";
  return `$${formatSmartPrice(price)}`;
}

