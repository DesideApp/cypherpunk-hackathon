// ai-token-agent/src/memoryManager.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.resolve(__dirname, '../memory');

const TOKENS_FILE = path.join(MEMORY_DIR, 'tokens-added.json');
const REJECTED_FILE = path.join(MEMORY_DIR, 'tokens-rejected.json');
const PREFERENCES_FILE = path.join(MEMORY_DIR, 'preferences.json');

/**
 * Asegura que existe el directorio de memoria
 */
async function ensureMemoryDir() {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  } catch (error) {
    // Directorio ya existe
  }
}

/**
 * Lee un archivo JSON de memoria
 */
async function readMemoryFile(filePath, defaultValue = []) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Archivo no existe, devolver valor por defecto
    return defaultValue;
  }
}

/**
 * Escribe un archivo JSON de memoria
 */
async function writeMemoryFile(filePath, data) {
  await ensureMemoryDir();
  await fs.writeFile(
    filePath, 
    JSON.stringify(data, null, 2), 
    'utf-8'
  );
}

/**
 * Guarda un token añadido en la memoria
 */
export async function saveTokenToMemory(tokenData) {
  const tokens = await readMemoryFile(TOKENS_FILE);
  
  // Verificar si ya existe (actualizar en vez de duplicar)
  const existingIndex = tokens.findIndex(t => t.mint === tokenData.mint);
  
  const entry = {
    ...tokenData,
    updatedAt: new Date().toISOString(),
  };
  
  if (existingIndex >= 0) {
    tokens[existingIndex] = entry;
  } else {
    tokens.push(entry);
  }
  
  await writeMemoryFile(TOKENS_FILE, tokens);
}

/**
 * Guarda un token rechazado
 */
export async function saveRejectedToken(tokenData, reason) {
  const rejected = await readMemoryFile(REJECTED_FILE);
  
  rejected.push({
    mint: tokenData.mint,
    code: tokenData.code,
    label: tokenData.label,
    reason,
    rejectedAt: new Date().toISOString(),
  });
  
  await writeMemoryFile(REJECTED_FILE, rejected);
}

/**
 * Obtiene todos los tokens añadidos
 */
export async function getAddedTokens() {
  return await readMemoryFile(TOKENS_FILE);
}

/**
 * Obtiene tokens rechazados
 */
export async function getRejectedTokens() {
  return await readMemoryFile(REJECTED_FILE);
}

/**
 * Obtiene/actualiza preferencias del usuario
 */
export async function getPreferences() {
  const defaults = {
    autoDownloadLogos: true,
    minLiquidity: 100000,
    minVolume24h: 50000,
    maxPriceImpact: 5,
    preferVerified: true,
    defaultMaxAmountUSD: 5000,
  };
  
  const prefs = await readMemoryFile(PREFERENCES_FILE, defaults);
  
  // Merge con defaults para añadir nuevas preferencias
  return { ...defaults, ...prefs };
}

/**
 * Actualiza preferencias
 */
export async function updatePreferences(updates) {
  const current = await getPreferences();
  const updated = { ...current, ...updates };
  await writeMemoryFile(PREFERENCES_FILE, updated);
  return updated;
}

/**
 * Genera estadísticas de la memoria
 */
export async function getMemoryStats() {
  const added = await getAddedTokens();
  const rejected = await getRejectedTokens();
  const prefs = await getPreferences();
  
  return {
    totalAdded: added.length,
    totalRejected: rejected.length,
    mostRecentAdded: added.length > 0 
      ? added[added.length - 1] 
      : null,
    preferences: prefs,
    tokens: added,
  };
}

/**
 * Limpia tokens antiguos de la memoria
 */
export async function cleanupOldTokens(daysOld = 90) {
  const tokens = await getAddedTokens();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const filtered = tokens.filter(token => {
    const addedDate = new Date(token.addedAt);
    return addedDate >= cutoffDate;
  });
  
  await writeMemoryFile(TOKENS_FILE, filtered);
  
  return {
    removed: tokens.length - filtered.length,
    kept: filtered.length,
  };
}

