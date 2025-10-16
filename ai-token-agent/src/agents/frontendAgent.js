// ai-token-agent/src/agents/frontendAgent.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const ENV_TOKENS = path.join(PROJECT_ROOT, 'frontend/.env.tokens');
const TOKENS_JSON = path.join(PROJECT_ROOT, 'frontend/config/tokens.json');
const TOKENS_DIR = path.join(PROJECT_ROOT, 'frontend/public/tokens');

/**
 * Frontend Agent - Solo modifica frontend/.env.tokens y descarga logos
 */
export class FrontendAgent {
  
  /**
   * Añade un token a .env.tokens
   */
  async addToken(tokenData) {
    const results = {
      env: false,
      json: false,
      logo: null,
      errors: [],
    };
    
    try {
      // Actualizar .env.tokens
      const envResult = await this.updateEnvTokens(tokenData.code, 'add');
      results.env = envResult.success;
      if (!envResult.success) {
        results.errors.push(`env.tokens: ${envResult.reason}`);
      }
      
      // Actualizar tokens.json
      const jsonResult = await this.updateTokensJson(tokenData.code, 'add');
      results.json = jsonResult.success;
      if (!jsonResult.success) {
        results.errors.push(`tokens.json: ${jsonResult.reason}`);
      }
      
      // Descargar logo
      if (tokenData.logoURI) {
        results.logo = await this.downloadLogo(tokenData.logoURI, tokenData.code);
      }
      
      return results;
      
    } catch (error) {
      results.errors.push(error.message);
      return results;
    }
  }
  
  /**
   * Remueve un token de .env.tokens
   */
  async removeToken(tokenCode) {
    const results = {
      env: false,
      json: false,
      logo: false,
      errors: [],
    };
    
    try {
      // Actualizar .env.tokens
      const envResult = await this.updateEnvTokens(tokenCode, 'remove');
      results.env = envResult.success;
      
      // Actualizar tokens.json
      const jsonResult = await this.updateTokensJson(tokenCode, 'remove');
      results.json = jsonResult.success;
      
      // Remover logo
      results.logo = await this.removeLogo(tokenCode);
      
      return results;
      
    } catch (error) {
      results.errors.push(error.message);
      return results;
    }
  }
  
  /**
   * Actualiza .env.tokens
   */
  async updateEnvTokens(tokenCode, action) {
    try {
      let content = '';
      try {
        content = await fs.readFile(ENV_TOKENS, 'utf-8');
      } catch {
        // Archivo no existe, crear
        content = 'VITE_ALLOWED_TOKENS=\n';
      }
      
      const match = content.match(/VITE_ALLOWED_TOKENS=([^\n]*)/);
      let tokens = [];
      
      if (match && match[1]) {
        tokens = match[1].split(',').map(t => t.trim()).filter(Boolean);
      }
      
      if (action === 'add') {
        if (!tokens.includes(tokenCode)) {
          tokens.push(tokenCode);
        }
      } else if (action === 'remove') {
        tokens = tokens.filter(t => t !== tokenCode);
      }
      
      const newContent = `VITE_ALLOWED_TOKENS=${tokens.join(',')}\n`;
      await fs.writeFile(ENV_TOKENS, newContent, 'utf-8');
      
      return { success: true };
      
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }
  
  /**
   * Actualiza frontend/config/tokens.json
   */
  async updateTokensJson(tokenCode, action) {
    try {
      let config = { allowedTokenCodes: [], lastUpdated: new Date().toISOString() };
      
      try {
        const content = await fs.readFile(TOKENS_JSON, 'utf-8');
        config = JSON.parse(content);
      } catch {
        // Crear si no existe
      }
      
      if (action === 'add') {
        if (!config.allowedTokenCodes.includes(tokenCode)) {
          config.allowedTokenCodes.push(tokenCode);
        }
      } else if (action === 'remove') {
        config.allowedTokenCodes = config.allowedTokenCodes.filter(c => c !== tokenCode);
      }
      
      config.lastUpdated = new Date().toISOString();
      
      await fs.writeFile(
        TOKENS_JSON,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      
      return { success: true };
      
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }
  
  /**
   * Descarga el logo del token
   */
  async downloadLogo(logoURI, tokenCode) {
    try {
      await fs.mkdir(TOKENS_DIR, { recursive: true });
      
      const response = await fetch(logoURI, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DesideTokenAgent/1.0)' },
        timeout: 10000,
      });
      
      if (!response.ok) {
        return { success: false, reason: `HTTP ${response.status}` };
      }
      
      const buffer = await response.arrayBuffer();
      const ext = logoURI.split('.').pop().split('?')[0].toLowerCase() || 'png';
      const filename = path.join(TOKENS_DIR, `${tokenCode.toLowerCase()}.${ext}`);
      
      await fs.writeFile(filename, Buffer.from(buffer));
      
      return { success: true, ext };
      
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }
  
  /**
   * Remueve el logo del token
   */
  async removeLogo(tokenCode) {
    for (const ext of ['png', 'jpg', 'jpeg', 'svg', 'webp']) {
      try {
        const logoPath = path.join(TOKENS_DIR, `${tokenCode.toLowerCase()}.${ext}`);
        await fs.unlink(logoPath);
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }
}

