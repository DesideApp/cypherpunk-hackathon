import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = process.env.MONGO_DB_NAME || undefined;
const RELAY_TTL_SECONDS = Number(process.env.RELAY_TTL_SECONDS || 2592000); // 30d

await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : {});
const db = mongoose.connection.db;

// Intenta con nombres comunes
const candidates = ['relaymessages', 'relaymessage', 'messages', 'relay'];
let target = null;
for (const name of candidates) {
  const exists = await db.listCollections({ name }).hasNext();
  if (exists) { target = name; break; }
}
if (!target) {
  throw new Error('No se encontró la colección del relay (probé: ' + candidates.join(', ') + ')');
}

const idxName = 'createdAt_1';
const coll = db.collection(target);

// Intenta modificar TTL con collMod; si no existe el índice, créalo.
try {
  const cmd = {
    collMod: target,
    index: { name: idxName, expireAfterSeconds: RELAY_TTL_SECONDS },
  };
  const modRes = await db.command(cmd);
  console.log(`✅ TTL modificado con collMod en "${target}" → ${RELAY_TTL_SECONDS}s.`, modRes);
} catch (e) {
  const msg = e?.message || String(e);
  if (msg.includes('Index not found') || msg.includes('ns not found') || msg.includes('no such cmd') || msg.includes('not found')) {
    const createRes = await coll.createIndex({ createdAt: 1 }, { expireAfterSeconds: RELAY_TTL_SECONDS, name: idxName });
    console.log(`ℹ️ Índice no existía. Creado TTL en "${target}" → ${RELAY_TTL_SECONDS}s.`, createRes);
  } else if (msg.includes('IndexOptionsConflict') || msg.includes('IndexKeySpecsConflict')) {
    // Como fallback, intenta dropear y recrear
    try {
      await coll.dropIndex(idxName);
      const createRes = await coll.createIndex({ createdAt: 1 }, { expireAfterSeconds: RELAY_TTL_SECONDS, name: idxName });
      console.log(`🔁 TTL recreado en "${target}" → ${RELAY_TTL_SECONDS}s.`, createRes);
    } catch (e2) {
      console.error('❌ Error al recrear TTL:', e2?.message || e2);
      process.exit(1);
    }
  } else {
    console.error('❌ Error al modificar TTL con collMod:', e?.message || e);
    process.exit(1);
  }
}

await mongoose.disconnect();
