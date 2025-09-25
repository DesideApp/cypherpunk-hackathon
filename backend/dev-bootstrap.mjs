import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import jwt from 'jsonwebtoken';
import { getPrivateKey } from '#shared/services/keyManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootEnvPath = resolve(__dirname, '../.env');

dotenv.config({ path: rootEnvPath });

const log = (...args) => console.error('[BOOT]', ...args);

process.on('uncaughtException', (err) => {
  log('🔥 Uncaught exception');
  if (err?.stack) console.error(err.stack);
  else console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('⚠️ Unhandled rejection');
  if (reason?.stack) console.error(reason.stack);
  else console.error(reason);
  process.exit(1);
});

process.on('exit', (code) => {
  log('👋 Process exit', code);
});

const privateKey = getPrivateKey();
if (!privateKey) {
  log('❌ JWT private key not loaded. Revisa JWT_PRIVATE_KEY_PATH o JWT_PRIVATE_KEY.');
  process.exit(1);
}

try {
  jwt.sign({ ping: 'ok' }, privateKey, { algorithm: 'RS256', expiresIn: '1m' });
} catch (err) {
  log('❌ Error firmando token de prueba con RS256:', err.message);
  process.exit(1);
}

log('Loading server.js...');

await import('./server.js');

log('server.js import finished (no startup errors).');
