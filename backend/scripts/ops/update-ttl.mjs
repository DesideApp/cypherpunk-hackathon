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

// Asegura/actualiza índice TTL sobre createdAt
const res = await db.collection(target).createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: RELAY_TTL_SECONDS, name: 'createdAt_1' }
);
console.log(`✅ TTL actualizado en "${target}" → ${RELAY_TTL_SECONDS}s. Respuesta:`, res);
await mongoose.disconnect();
