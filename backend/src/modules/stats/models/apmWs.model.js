import mongoose from 'mongoose';

const ttlDays = Math.max(1, parseInt(process.env.APM_WS_TTL_DAYS || '30', 10));
const ttlSeconds = ttlDays * 24 * 60 * 60;

const APMWsSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now, index: true },
  event: { type: String, index: true },
  wallet: { type: String, default: null, index: true },
  peer: { type: String, default: null },
  convId: { type: String, default: null },
  ok: { type: Boolean, default: true },
  detail: { type: String, default: null },
  durationMs: { type: Number, default: null },
}, { versionKey: false });

APMWsSchema.index({ ts: 1 }, { expireAfterSeconds: ttlSeconds, name: 'apm_ws_ttl' });

export default mongoose.model('APMWs', APMWsSchema, 'apm_ws');

