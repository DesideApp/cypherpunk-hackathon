// src/config/env.js
import { cleanEnv, str, bool, num } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV:                 str({ default: 'development' }),
  PORT:                     num({ default: 5000 }),
  WEBSOCKET_PORT:           num({ default: 5001 }),
  MONGO_URI:                str({ default: '' }),
  MONGO_DB_NAME:            str({ default: '' }),
  // Optional override: 'true' | 'false' (empty = default behavior)
  MONGO_AUTO_INDEX:         str({ default: '' }),
  ALLOWED_ORIGINS:          str({ default: '' }),

  // Relay (cap global por mensaje + ttl de red de seguridad)
  ENABLE_RELAY:             bool({ default: true }),
  RELAY_OFFLINE_ONLY:       bool({ default: true }),
  RELAY_MAX_BOX_BYTES:      num({ default: 3_000_000 }),        // 3 MB FINAL
  RELAY_TTL_SECONDS:        num({ default: 30 * 24 * 3600 }),   // 30 días

  DIALECT_API_BASE_URL:     str({ default: 'https://api.dial.to/v1' }),
  DIALECT_BLINK_CLIENT_KEY: str({ default: '' }),
  TELEGRAM_BUY_BLINK_BASE_URL: str({ default: '' }),
  TELEGRAM_BUY_SHARE_BASE_URL: str({ default: '' }),
  TELEGRAM_TOKEN_LIST:         str({ default: '' }),
  TELEGRAM_ALLOW_GROUP_MESSAGES: bool({ default: false }),

  // Jupiter (Ultra/API Gateway)
  JUPITER_API_KEY:          str({ default: '' }),
  JUPITER_QUOTE_URL:        str({ default: 'https://quote-api.jup.ag/v6/quote' }),
  JUPITER_SWAP_URL:         str({ default: 'https://quote-api.jup.ag/v6/swap' }),
  JUPITER_PLATFORM_FEE_BPS: num({ default: 0 }),
  JUPITER_FEE_ACCOUNT:      str({ default: '' }),

  COINGECKO_API_KEY:        str({ default: '' }),
  COINGECKO_API_BASE_URL:   str({ default: 'https://api.coingecko.com/api/v3' }),

  // Token mints para blinks de compra
  MINT_BONK:                str({ default: '' }),
  MINT_JUP:                 str({ default: '' }),
  MINT_PENGU:               str({ default: '' }),
  MINT_PUMP:                str({ default: '' }),
  MINT_WIF:                 str({ default: '' }),
  MINT_JitoSOL:             str({ default: '' }),

  SOLANA_RPC_URL:           str({ default: 'https://api.mainnet-beta.solana.com' }),
  SOLANA_COMMITMENT:        str({ default: 'confirmed' }),
  SOLANA_CLUSTER:           str({ default: 'mainnet-beta' }),
  SOLANA_TIMEOUT_MS:        num({ default: 20_000 }),

  // Auth para pruebas (Bearer)
  ALLOW_BEARER_AUTH:        bool({ default: false }),
  BEARER_ROUTE_WHITELIST:   str({ default: '^/api/relay/,^/api/signal/' }),
  INTERNAL_API_SECRET:      str({ default: '' }),

  // Límite del body JSON (para que quepa box + sobrecarga JSON)
  JSON_BODY_LIMIT_MB:       num({ default: 6 }),                // seguro para 3MB en base64

  // Presets de media (guías para el cliente)
  IMG_MAX_LONG_EDGE:        num({ default: 1080 }),
  IMG_JPEG_QUALITY:         num({ default: 72 }),               // 0..100
  AUDIO_TARGET_CODEC:       str({ default: 'opus' }),
  AUDIO_TARGET_BITRATE_K:   num({ default: 24 }),               // kbps
  AUDIO_TARGET_SAMPLERATE:  num({ default: 24000 }),
  VIDEO_MAX_LONG_EDGE:      num({ default: 480 }),
  VIDEO_MAX_DURATION_BASIC_SEC:   num({ default: 20 }),
  VIDEO_MAX_DURATION_PREMIUM_SEC: num({ default: 30 }),
});
