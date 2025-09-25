// scripts/ops/update-ttl.js
import mongoose from 'mongoose';
import RelayMessage from '../../src/models/RelayMessage.js';

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME;
const NEW_TTL = parseInt(process.env.RELAY_TTL_SECONDS ?? '172800', 10);

(async () => {
  await mongoose.connect(uri, dbName ? { dbName, serverSelectionTimeoutMS: 15000 } : { serverSelectionTimeoutMS: 15000 });
  try {
    const collName = RelayMessage.collection?.collectionName;
    if (!collName) throw new Error('RelayMessage collection not initialized');

    await mongoose.connection.db.command({
      collMod: collName,
      index: { name: 'createdAt_1', expireAfterSeconds: NEW_TTL }
    });
    console.log('✅ TTL actualizado con collMod a', NEW_TTL);
  } catch (e) {
    console.warn('ℹ️ collMod no disponible o fallo, intento drop+create:', e?.code || e?.message || e);
    try { await RelayMessage.collection.dropIndex('createdAt_1'); } catch (dropErr) { /* ignore */ }
    await mongoose.connection.db
      .collection(RelayMessage.collection.collectionName)
      .createIndex({ createdAt: 1 }, { expireAfterSeconds: NEW_TTL, name: 'createdAt_1' });
    console.log('✅ TTL recreado a', NEW_TTL);
  }
  const idx = await RelayMessage.collection.indexes();
  console.log('📑 Índices ahora:', idx);
  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error('❌ update-ttl failed:', e?.code || e?.message || e); process.exit(1); });
