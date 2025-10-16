// backend/src/modules/tokens/services/tokenService.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_CONFIG_PATH = path.resolve(__dirname, '../../../../config/tokens.json');

/**
 * Lee la configuración de tokens desde tokens.json
 */
export async function loadTokensConfig() {
  try {
    const content = await fs.readFile(TOKENS_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content);
    return config;
  } catch (error) {
    console.error('[tokenService] Error loading tokens.json:', error.message);
    // Fallback a configuración vacía
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      allowedTokens: [],
    };
  }
}

/**
 * Obtiene la lista de tokens permitidos
 */
export async function getAllowedTokens() {
  const config = await loadTokensConfig();
  return config.allowedTokens || [];
}

/**
 * Obtiene un token específico por código
 */
export async function getTokenByCode(code) {
  const tokens = await getAllowedTokens();
  return tokens.find(t => t.code.toUpperCase() === code.toUpperCase());
}

/**
 * Obtiene un token específico por mint
 */
export async function getTokenByMint(mint) {
  const tokens = await getAllowedTokens();
  return tokens.find(t => t.mint === mint);
}

/**
 * Convierte la lista de tokens al formato legacy (para compatibilidad)
 */
export async function getTokensAsLegacyFormat() {
  const tokens = await getAllowedTokens();
  
  const legacyFormat = {};
  
  tokens.forEach(token => {
    legacyFormat[token.code] = {
      mint: token.mint,
      code: token.code,
      label: token.label,
      decimals: token.decimals,
      maxAmount: token.maxAmount,
      minAmount: token.minAmount,
    };
  });
  
  return legacyFormat;
}

/**
 * Guarda la configuración de tokens
 */
export async function saveTokensConfig(config) {
  try {
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(TOKENS_CONFIG_PATH, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('[tokenService] Error saving tokens.json:', error.message);
    return false;
  }
}

/**
 * Añade un token a la configuración
 */
export async function addTokenToConfig(tokenData) {
  try {
    const config = await loadTokensConfig();
    
    // Verificar si ya existe
    const exists = config.allowedTokens.find(t => 
      t.mint === tokenData.mint || t.code === tokenData.code
    );
    
    if (exists) {
      return {
        success: false,
        reason: `Token ${tokenData.code} ya existe`,
      };
    }
    
    // Añadir nuevo token
    const newToken = {
      mint: tokenData.mint,
      code: tokenData.code,
      label: tokenData.label,
      decimals: tokenData.decimals,
      maxAmount: tokenData.maxAmount,
      minAmount: tokenData.minAmount,
      verified: tokenData.verified || false,
      addedBy: 'ai-agent-api',
      addedAt: new Date().toISOString(),
    };
    
    config.allowedTokens.push(newToken);
    config.lastUpdated = new Date().toISOString();
    
    // Guardar
    const saved = await saveTokensConfig(config);
    
    if (!saved) {
      return {
        success: false,
        reason: 'Error saving tokens.json',
      };
    }
    
    return {
      success: true,
      token: newToken,
    };
    
  } catch (error) {
    return {
      success: false,
      reason: error.message,
    };
  }
}

