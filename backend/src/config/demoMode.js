const truthy = new Set(['1', 'true', 'yes', 'on']);

const rawDemo = (process.env.DEMO_MODE || '').toLowerCase().trim();
export const IS_DEMO_MODE = truthy.has(rawDemo);

if (IS_DEMO_MODE) {
  const ensure = (key, value) => {
    if (!process.env[key] || process.env[key] === '') {
      process.env[key] = value;
    }
  };

  const ensureBool = (key, value) => ensure(key, value ? 'true' : 'false');

  // Base toggles → evita conexiones/productos reales
  ensure('DATA_MODE', 'memory');
  ensureBool('SEED_DEMO', true);
  ensure('RTC_PROVIDER', 'demo');
  ensureBool('ENABLE_RELAY', true);

  // Evita que queden credenciales externas activas por accidente
  if (process.env.MONGO_URI && process.env.MONGO_URI.trim() !== '') {
    console.warn('[DEMO] Ignoring provided MONGO_URI while DEMO_MODE is active.');
  }
  process.env.MONGO_URI = '';

  const twilioKeys = ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY', 'TWILIO_API_SECRET'];
  for (const key of twilioKeys) {
    if (process.env[key]) {
      console.warn(`[DEMO] ${key} is ignored while DEMO_MODE=1.`);
      process.env[key] = '';
    }
  }

  console.info('[DEMO] Demo mode enabled: using in-memory MongoDB, local fixtures and mock RTC.');
}

export default IS_DEMO_MODE;
