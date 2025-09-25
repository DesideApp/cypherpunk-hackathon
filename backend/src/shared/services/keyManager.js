// src/shared/services/keyManager.js
import fs from 'fs';
import path from 'path';

const normalizeKey = (raw, label) => {
  if (!raw) return null;
  const cleaned = raw.replace(/\r?\n/g, '\n').trim();
  if (!cleaned.includes('BEGIN') || !cleaned.includes('END')) {
    throw new Error(`❌ Clave malformada (${label})`);
  }
  return cleaned;
};

const readKeyFromEnv = (envVar, label) => {
  try {
    return normalizeKey(process.env[envVar], `${label} env`);
  } catch (err) {
    console.error(err.message);
    return null;
  }
};

const readKeyFromFile = (envVar, label) => {
  const filePath = process.env[envVar];
  if (!filePath) return null;
  const resolved = path.resolve(process.cwd(), filePath);
  try {
    const fileContents = fs.readFileSync(resolved, 'utf8');
    return normalizeKey(fileContents, `${label} file`);
  } catch (err) {
    console.error(`❌ No se pudo leer ${label} en ${resolved}: ${err.message}`);
    return null;
  }
};

let cachedPrivateKey = null;
let cachedPublicKey = null;

export const getPrivateKey = () => {
  if (cachedPrivateKey) return cachedPrivateKey;
  cachedPrivateKey =
    readKeyFromFile('JWT_PRIVATE_KEY_PATH', 'PRIVATE_KEY') ||
    readKeyFromEnv('JWT_PRIVATE_KEY', 'PRIVATE_KEY');
  return cachedPrivateKey;
};

export const getPublicKey = () => {
  if (cachedPublicKey) return cachedPublicKey;
  cachedPublicKey =
    readKeyFromFile('JWT_PUBLIC_KEY_PATH', 'PUBLIC_KEY') ||
    readKeyFromEnv('JWT_PUBLIC_KEY', 'PUBLIC_KEY');
  return cachedPublicKey;
};
