// ai-token-agent/src/jupiterValidator.js
import fetch from 'node-fetch';

const JUPITER_TOKEN_LIST_URL = 'https://cache.jup.ag/tokens';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';
const JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Cache de la lista de tokens de Jupiter (válido por 1 hora)
 */
let tokenListCache = null;
let tokenListCacheTime = 0;
const CACHE_DURATION = 3600000; // 1 hora

/**
 * Obtiene la lista completa de tokens de Jupiter (con cache)
 */
async function getJupiterTokenList() {
  const now = Date.now();
  
  if (tokenListCache && (now - tokenListCacheTime) < CACHE_DURATION) {
    return tokenListCache;
  }
  
  try {
    const response = await fetch(JUPITER_TOKEN_LIST_URL);
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }
    
    const tokens = await response.json();
    tokenListCache = tokens;
    tokenListCacheTime = now;
    
    return tokens;
  } catch (error) {
    throw new Error(`Error fetching Jupiter token list: ${error.message}`);
  }
}

/**
 * PASO 1: Validar que el token existe en Jupiter
 */
export async function validateTokenInJupiter(mintAddress) {
  try {
    const tokens = await getJupiterTokenList();
    const token = tokens.find(t => t.address === mintAddress);
    
    if (!token) {
      return {
        valid: false,
        reason: 'Token no encontrado en Jupiter',
      };
    }
    
    return {
      valid: true,
      data: {
        mint: token.address,
        code: token.symbol,
        label: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI || null,
        tags: token.tags || [],
        verified: token.extensions?.coingeckoId ? true : false,
        coingeckoId: token.extensions?.coingeckoId || null,
      }
    };
  } catch (error) {
    return {
      valid: false,
      reason: `Error validando token: ${error.message}`,
    };
  }
}

/**
 * PASO 2: Verificar liquidez real haciendo un quote de prueba
 */
export async function checkLiquidity(mintAddress) {
  const TEST_AMOUNT = 100000000; // 0.1 SOL en lamports
  
  try {
    const params = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: mintAddress,
      amount: TEST_AMOUNT.toString(),
      slippageBps: '150',
      onlyDirectRoutes: 'false',
    });
    
    const response = await fetch(`${JUPITER_QUOTE_URL}?${params}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        hasLiquidity: false,
        reason: errorData?.error || 'No hay rutas de swap disponibles',
      };
    }
    
    const quote = await response.json();
    
    if (!quote.outAmount || quote.outAmount === '0') {
      return {
        hasLiquidity: false,
        reason: 'Quote devuelve 0 tokens',
      };
    }
    
    return {
      hasLiquidity: true,
      priceImpact: parseFloat(quote.priceImpactPct || 0),
      outAmount: quote.outAmount,
      routeInfo: {
        numberOfRoutes: quote.routePlan?.length || 0,
        marketInfos: quote.marketInfos || [],
      }
    };
  } catch (error) {
    return {
      hasLiquidity: false,
      reason: `Error verificando liquidez: ${error.message}`,
    };
  }
}

/**
 * PASO 3: Obtener precio actual desde Jupiter Price API
 */
export async function getTokenPrice(mintAddress) {
  try {
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${mintAddress}`);
    
    if (!response.ok) {
      return { 
        price: null, 
        change24h: null,
        volume24h: null,
        reason: 'API no disponible' 
      };
    }
    
    const data = await response.json();
    const priceData = data.data?.[mintAddress];
    
    if (!priceData) {
      return { 
        price: null, 
        change24h: null,
        volume24h: null,
        reason: 'Precio no disponible' 
      };
    }
    
    return {
      price: priceData.price || null,
      change24h: priceData.extraInfo?.quotedPrice?.change24hPercent || null,
      volume24h: priceData.extraInfo?.quotedPrice?.volume24h || null,
      marketCap: priceData.extraInfo?.quotedPrice?.marketCap || null,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    return { 
      price: null, 
      change24h: null,
      volume24h: null,
      reason: error.message 
    };
  }
}

/**
 * Buscar token por símbolo (útil para discovery)
 */
export async function findTokenBySymbol(symbol) {
  try {
    const tokens = await getJupiterTokenList();
    const matches = tokens.filter(t => 
      t.symbol.toLowerCase() === symbol.toLowerCase()
    );
    
    if (matches.length === 0) {
      return { found: false, reason: 'Symbol no encontrado' };
    }
    
    if (matches.length > 1) {
      return {
        found: true,
        multiple: true,
        tokens: matches.map(t => ({
          mint: t.address,
          name: t.name,
          decimals: t.decimals,
        }))
      };
    }
    
    return {
      found: true,
      multiple: false,
      token: matches[0],
    };
  } catch (error) {
    return {
      found: false,
      reason: error.message,
    };
  }
}

/**
 * Buscar token por símbolo (búsqueda parcial)
 */
export async function findTokenBySymbolPartial(symbol) {
  try {
    const tokens = await getJupiterTokenList();
    const query = symbol.toLowerCase();
    
    // Buscar coincidencias con scoring de relevancia
    const matches = tokens
      .map(t => {
        const symbol = t.symbol.toLowerCase();
        const name = t.name.toLowerCase();
        const queryLower = query.toLowerCase();
        
        let score = 0;
        let matchType = '';
        
        // Coincidencia exacta en símbolo (máxima prioridad)
        if (symbol === queryLower) {
          score = 1000;
          matchType = 'exact_symbol';
        }
        // Coincidencia exacta en nombre
        else if (name === queryLower) {
          score = 900;
          matchType = 'exact_name';
        }
        // Coincidencia al inicio del símbolo
        else if (symbol.startsWith(queryLower)) {
          score = 800;
          matchType = 'prefix_symbol';
        }
        // Coincidencia al inicio del nombre
        else if (name.startsWith(queryLower)) {
          score = 700;
          matchType = 'prefix_name';
        }
        // Coincidencia parcial en símbolo
        else if (symbol.includes(queryLower)) {
          score = 600;
          matchType = 'partial_symbol';
        }
        // Coincidencia parcial en nombre
        else if (name.includes(queryLower)) {
          score = 500;
          matchType = 'partial_name';
        }
        
        // Si no hay coincidencia, no incluir
        if (score === 0) return null;
        
        // Bonus por verificación
        if (t.extensions?.coingeckoId) {
          score += 100;
        }
        
        return {
          ...t,
          _score: score,
          _matchType: matchType,
        };
      })
      .filter(Boolean); // Eliminar nulls
    
    if (matches.length === 0) {
      return { found: false, reason: 'Symbol no encontrado' };
    }
    
    // Si hay múltiples coincidencias, ordenar por relevancia
    if (matches.length > 1) {
      // Ordenar por score (relevancia) descendente
      const sortedMatches = matches.sort((a, b) => {
        if (a._score !== b._score) return b._score - a._score;
        // Si mismo score, verificados primero
        const aVerified = a.extensions?.coingeckoId ? 1 : 0;
        const bVerified = b.extensions?.coingeckoId ? 1 : 0;
        return bVerified - aVerified;
      });
      
      return {
        found: true,
        multiple: true,
        tokens: sortedMatches.slice(0, 5).map(t => ({
          mint: t.address,
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          logoURI: t.logoURI,
          verified: t.extensions?.coingeckoId ? true : false,
          matchType: t._matchType,
          score: t._score,
        }))
      };
    }
    
    return {
      found: true,
      multiple: false,
      token: matches[0],
    };
  } catch (error) {
    return {
      found: false,
      reason: error.message,
    };
  }
}

/**
 * Validación completa de un token (todos los pasos)
 */
export async function validateTokenComplete(mintAddress) {
  const results = {
    mint: mintAddress,
    validation: null,
    liquidity: null,
    price: null,
    passed: false,
  };
  
  // Paso 1: Validar existencia
  results.validation = await validateTokenInJupiter(mintAddress);
  if (!results.validation.valid) {
    return results;
  }
  
  // Paso 2: Verificar liquidez
  results.liquidity = await checkLiquidity(mintAddress);
  if (!results.liquidity.hasLiquidity) {
    return results;
  }
  
  // Paso 3: Obtener precio
  results.price = await getTokenPrice(mintAddress);
  
  // Token pasó todas las validaciones
  results.passed = true;
  
  return results;
}

