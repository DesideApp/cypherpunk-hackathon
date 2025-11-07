// s#config/runtimeConfig.js
import dotenv from 'dotenv';
dotenv.config();

const bool = (v, def=false) => v == null ? def : String(v).toLowerCase() === 'true';
const int  = (v, def) => Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : def;

const relay = {
  enabled:      bool(process.env.ENABLE_RELAY,        true),
  offlineOnly:  bool(process.env.RELAY_OFFLINE_ONLY,  true),
  maxBoxBytes:  int(process.env.RELAY_MAX_BOX_BYTES,  3_000_000),   // ← recomendado
  globalTTLsec: int(process.env.RELAY_TTL_SECONDS,    30*24*3600),  // red de seguridad
};

const attachmentVault = {
  bucket: process.env.R2_ATTACHMENTS_BUCKET || '',
  prefix: process.env.R2_ATTACHMENTS_PREFIX || 'relay-attachments',
  endpoint: process.env.R2_ATTACHMENTS_ENDPOINT || '',
  maxUploadBytes: int(process.env.ATTACHMENT_MAX_BYTES, 15 * 1024 * 1024),
  uploadUrlTtlSeconds: int(process.env.ATTACHMENT_UPLOAD_TTL_SECONDS, 300),
};

// Helpers de tamaño/base64
const base64 = {
  overheadFactor: 4/3,
  estimateBase64(bytesRaw) { return Math.ceil(bytesRaw / 3) * 4; },
  maxRawFor(capBase64)     { return Math.floor(capBase64 * 3 / 4); },
};

export default { relay, base64, attachmentVault };
