// ai-token-agent/src/agents/backendAgent.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const TOKENS_JSON = path.join(PROJECT_ROOT, 'backend/config/tokens.json');

/**
 * Backend Agent - Solo modifica backend/config/tokens.json
 */
export class BackendAgent {
  
  /**
   * Añade un token a tokens.json
   */
  async addToken(tokenData) {
    try {
      // Leer configuración actual
      const content = await fs.readFile(TOKENS_JSON, 'utf-8');
      const config = JSON.parse(content);
      
      // Verificar si ya existe
      const exists = config.allowedTokens.find(t => 
        t.mint === tokenData.mint || t.code === tokenData.code
      );
      
      if (exists) {
        return {
          success: false,
          reason: `Token ${tokenData.code} ya existe`,
          action: 'skip',
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
        addedBy: 'ai-agent',
        addedAt: new Date().toISOString(),
      };
      
      config.allowedTokens.push(newToken);
      config.lastUpdated = new Date().toISOString();
      
      // Guardar
      await fs.writeFile(
        TOKENS_JSON,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      
      return {
        success: true,
        action: 'added',
        file: 'backend/config/tokens.json',
      };
      
    } catch (error) {
      return {
        success: false,
        reason: error.message,
        action: 'error',
      };
    }
  }
  
  /**
   * Remueve un token de tokens.json
   */
  async removeToken(tokenCode) {
    try {
      const content = await fs.readFile(TOKENS_JSON, 'utf-8');
      const config = JSON.parse(content);
      
      const initialLength = config.allowedTokens.length;
      config.allowedTokens = config.allowedTokens.filter(t => 
        t.code.toUpperCase() !== tokenCode.toUpperCase()
      );
      
      if (config.allowedTokens.length === initialLength) {
        return {
          success: false,
          reason: `Token ${tokenCode} no encontrado`,
          action: 'not_found',
        };
      }
      
      config.lastUpdated = new Date().toISOString();
      
      await fs.writeFile(
        TOKENS_JSON,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      
      return {
        success: true,
        action: 'removed',
        file: 'backend/config/tokens.json',
      };
      
    } catch (error) {
      return {
        success: false,
        reason: error.message,
        action: 'error',
      };
    }
  }
  
  /**
   * Lista tokens actuales
   */
  async listTokens() {
    try {
      const content = await fs.readFile(TOKENS_JSON, 'utf-8');
      const config = JSON.parse(content);
      return {
        success: true,
        tokens: config.allowedTokens,
      };
    } catch (error) {
      return {
        success: false,
        reason: error.message,
        tokens: [],
      };
    }
  }
}

