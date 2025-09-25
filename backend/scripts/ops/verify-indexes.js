// scripts/ops/verify-indexes.js
import mongoose from 'mongoose';
import RelayMessage from '../../src/models/RelayMessage.js';

const uri = process.env.MONGO_URI;
const opts = process.env.MONGO_DB_NAME ? { dbName: process.env.MONGO_DB_NAME } : {};

(async () => {
  await mongoose.connect(uri, opts);
  await RelayMessage.syncIndexes();
  const idx = await RelayMessage.collection.indexes();
  console.log('📑 Índices relay:', idx);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
