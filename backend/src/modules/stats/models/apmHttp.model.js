import mongoose from 'mongoose';

const ttlDays = Math.max(1, parseInt(process.env.APM_HTTP_TTL_DAYS || '30', 10));
const ttlSeconds = ttlDays * 24 * 60 * 60;

const APMHttpSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now, index: true },
  method: { type: String, index: true },
  route: { type: String, index: true },
  status: { type: Number, index: true },
  durationMs: { type: Number, index: true },
  bytesIn: { type: Number, default: 0 },
  bytesOut: { type: Number, default: 0 },
  wallet: { type: String, default: null },
  userAgent: { type: String, default: null },
  ip: { type: String, default: null },
}, { versionKey: false });

// TTL on ts
APMHttpSchema.index({ ts: 1 }, { expireAfterSeconds: ttlSeconds, name: 'apm_http_ttl' });

export default mongoose.model('APMHttp', APMHttpSchema, 'apm_http');

