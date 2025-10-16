// ai-token-agent/src/codeGenerator.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const BACKEND_FILE = path.join(PROJECT_ROOT, 'backend/src/shared/services/blinkValidationService.js');
const BACKEND_ENV_FILE = path.join(PROJECT_ROOT, 'backend/src/config/env.js');
const FRONTEND_FILE = path.join(PROJECT_ROOT, 'frontend/src/features/messaging/ui/modals/BuyTokenModal.jsx');
const FRONTEND_TOKENS_DIR = path.join(PROJECT_ROOT, 'frontend/public/tokens');

/**
 * Calcula maxAmount basado en precio USD
 * Objetivo: maxAmount * precio ≈ $5000 USD
 */
export function calculateMaxAmount(priceUSD, decimals) {
  if (!priceUSD || priceUSD <= 0) {
    // Sin precio, usar valor conservador
    return 10000;
  }
  
  const targetUSD = 5000;
  const maxTokens = targetUSD / priceUSD;
  
  // Redondear a número limpio
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxTokens)));
  const rounded = Math.ceil(maxTokens / magnitude) * magnitude;
  
  return rounded;
}

/**
 * Genera el código para el token
 */
export function generateTokenCode(tokenData) {
  const backendEntry = `  ${tokenData.code}: {
    mint: env.MINT_${tokenData.code} || '${tokenData.mint}',
    code: '${tokenData.code}',
    label: '${tokenData.label}',
    decimals: ${tokenData.decimals},
    maxAmount: ${tokenData.maxAmount},
    minAmount: ${tokenData.minAmount},
  },`;

  return {
    backend: backendEntry,
    frontend: `"${tokenData.code}"`,
    envExample: `MINT_${tokenData.code}=${tokenData.mint}`,
  };
}

/**
 * Verifica si un token ya está añadido en el backend
 */
export async function isTokenAlreadyAdded(tokenCode) {
  try {
    const content = await fs.readFile(BACKEND_FILE, 'utf-8');
    
    // Buscar si existe en ALLOWED_TOKENS
    const regex = new RegExp(`\\b${tokenCode}\\s*:\\s*{`, 'i');
    return regex.test(content);
  } catch (error) {
    throw new Error(`Error leyendo archivo backend: ${error.message}`);
  }
}

/**
 * Añade la variable env para el token
 */
export async function addTokenToEnvConfig(tokenData) {
  try {
    let content = await fs.readFile(BACKEND_ENV_FILE, 'utf-8');
    
    // Verificar si ya existe
    if (content.includes(`MINT_${tokenData.code}:`)) {
      return true; // Ya existe
    }
    
    // Buscar la última línea de MINT_*
    const pattern = /(MINT_\w+:\s+str\(\{ default: '' \}\),)\n/g;
    const matches = [...content.matchAll(pattern)];
    
    if (matches.length === 0) {
      throw new Error('No se encontró el patrón de MINT_ en env.js');
    }
    
    // Obtener la última coincidencia
    const lastMatch = matches[matches.length - 1];
    const insertPoint = lastMatch.index + lastMatch[0].length;
    
    // Insertar nueva variable
    const newLine = `  MINT_${tokenData.code}:             str({ default: '' }),\n`;
    
    content = content.slice(0, insertPoint) + newLine + content.slice(insertPoint);
    
    await fs.writeFile(BACKEND_ENV_FILE, content, 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Error añadiendo token a env.js: ${error.message}`);
  }
}

/**
 * Aplica el token al código del backend
 */
export async function applyTokenToBackend(tokenData, code) {
  try {
    let content = await fs.readFile(BACKEND_FILE, 'utf-8');
    
    // Buscar el final del objeto ALLOWED_TOKENS
    // Queremos insertar ANTES del cierre del objeto
    const pattern = /(\s+WIF:\s*{[^}]+},)\s*};/s;
    
    if (!pattern.test(content)) {
      throw new Error('No se pudo encontrar la estructura ALLOWED_TOKENS en el archivo');
    }
    
    // Insertar el nuevo token después del último token existente
    content = content.replace(pattern, `$1\n${code.backend}\n};`);
    
    await fs.writeFile(BACKEND_FILE, content, 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Error aplicando token al backend: ${error.message}`);
  }
}

/**
 * Aplica el token al código del frontend
 */
export async function applyTokenToFrontend(tokenData, code) {
  try {
    let content = await fs.readFile(FRONTEND_FILE, 'utf-8');
    
    // Buscar el Set de ALLOWED y añadir el token
    const pattern = /const\s+ALLOWED\s*=\s*new\s+Set\(\[(.*?)\]\);/s;
    
    const match = content.match(pattern);
    if (!match) {
      throw new Error('No se pudo encontrar ALLOWED Set en el archivo frontend');
    }
    
    // Extraer tokens actuales
    const currentTokensStr = match[1];
    const tokenList = currentTokensStr
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    
    // Verificar si ya existe
    if (tokenList.some(t => t.includes(tokenData.code))) {
      throw new Error(`Token ${tokenData.code} ya existe en frontend`);
    }
    
    // Añadir nuevo token
    tokenList.push(`"${tokenData.code}"`);
    
    // Reconstruir
    const newAllowedStr = `const ALLOWED = new Set([${tokenList.join(', ')}]);`;
    
    content = content.replace(pattern, newAllowedStr);
    
    await fs.writeFile(FRONTEND_FILE, content, 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Error aplicando token al frontend: ${error.message}`);
  }
}

/**
 * Descarga el logo del token
 */
export async function downloadTokenLogo(logoURI, tokenCode) {
  if (!logoURI) {
    return { success: false, reason: 'No logoURI disponible' };
  }
  
  try {
    // Asegurar que existe el directorio
    await fs.mkdir(FRONTEND_TOKENS_DIR, { recursive: true });
    
    const response = await fetch(logoURI, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DesideTokenAgent/1.0)',
      },
      timeout: 10000,
    });
    
    if (!response.ok) {
      return { 
        success: false, 
        reason: `HTTP ${response.status}` 
      };
    }
    
    const buffer = await response.arrayBuffer();
    
    // Detectar extensión desde URL o content-type
    let ext = 'png';
    const urlExt = logoURI.split('.').pop().split('?')[0].toLowerCase();
    if (['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(urlExt)) {
      ext = urlExt;
    }
    
    const filename = path.join(FRONTEND_TOKENS_DIR, `${tokenCode.toLowerCase()}.${ext}`);
    
    await fs.writeFile(filename, Buffer.from(buffer));
    
    return { 
      success: true, 
      path: filename,
      ext 
    };
  } catch (error) {
    return { 
      success: false, 
      reason: error.message 
    };
  }
}

/**
 * Aplica un token completo al codebase
 */
export async function applyTokenToCodebase(tokenData, options = {}) {
  const results = {
    backend: false,
    backendEnv: false,
    frontend: false,
    logo: null,
    errors: [],
  };
  
  // Verificar si ya existe
  const alreadyExists = await isTokenAlreadyAdded(tokenData.code);
  if (alreadyExists && !options.force) {
    throw new Error(`Token ${tokenData.code} ya existe. Usa --force para sobrescribir.`);
  }
  
  // Generar código
  const code = generateTokenCode(tokenData);
  
  // Añadir variable env
  try {
    await addTokenToEnvConfig(tokenData);
    results.backendEnv = true;
  } catch (error) {
    results.errors.push(`Backend env.js: ${error.message}`);
  }
  
  // Aplicar al backend
  try {
    await applyTokenToBackend(tokenData, code);
    results.backend = true;
  } catch (error) {
    results.errors.push(`Backend: ${error.message}`);
  }
  
  // Aplicar al frontend
  try {
    await applyTokenToFrontend(tokenData, code);
    results.frontend = true;
  } catch (error) {
    results.errors.push(`Frontend: ${error.message}`);
  }
  
  // Descargar logo
  if (tokenData.logoURI && options.downloadLogo !== false) {
    results.logo = await downloadTokenLogo(tokenData.logoURI, tokenData.code);
  }
  
  return results;
}

/**
 * Remueve un token del codebase
 */
export async function removeTokenFromCodebase(tokenCode) {
  const results = {
    backend: false,
    frontend: false,
    logo: false,
    errors: [],
  };
  
  // Remover del backend
  try {
    let content = await fs.readFile(BACKEND_FILE, 'utf-8');
    
    // Buscar y remover la entrada completa del token
    const tokenPattern = new RegExp(
      `\\s+${tokenCode}:\\s*{[^}]+},\\n`,
      'gi'
    );
    
    if (!tokenPattern.test(content)) {
      throw new Error('Token no encontrado en backend');
    }
    
    content = content.replace(tokenPattern, '');
    
    await fs.writeFile(BACKEND_FILE, content, 'utf-8');
    results.backend = true;
  } catch (error) {
    results.errors.push(`Backend: ${error.message}`);
  }
  
  // Remover del frontend
  try {
    let content = await fs.readFile(FRONTEND_FILE, 'utf-8');
    
    const pattern = /const\s+ALLOWED\s*=\s*new\s+Set\(\[(.*?)\]\);/s;
    const match = content.match(pattern);
    
    if (match) {
      const tokenList = match[1]
        .split(',')
        .map(t => t.trim())
        .filter(t => !t.includes(tokenCode));
      
      const newAllowedStr = `const ALLOWED = new Set([${tokenList.join(', ')}]);`;
      content = content.replace(pattern, newAllowedStr);
      
      await fs.writeFile(FRONTEND_FILE, content, 'utf-8');
      results.frontend = true;
    }
  } catch (error) {
    results.errors.push(`Frontend: ${error.message}`);
  }
  
  // Remover logo (intentar múltiples extensiones)
  for (const ext of ['png', 'jpg', 'jpeg', 'svg', 'webp']) {
    try {
      const logoPath = path.join(FRONTEND_TOKENS_DIR, `${tokenCode.toLowerCase()}.${ext}`);
      await fs.unlink(logoPath);
      results.logo = true;
      break;
    } catch (error) {
      // Continuar con siguiente extensión
    }
  }
  
  return results;
}

