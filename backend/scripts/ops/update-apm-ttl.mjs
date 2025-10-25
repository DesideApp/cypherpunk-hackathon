import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = process.env.MONGO_DB_NAME || undefined;

const httpDays = Number(process.env.APM_HTTP_TTL_DAYS || 30);
const wsDays   = Number(process.env.APM_WS_TTL_DAYS || 30);
const httpTTL  = Math.max(24 * 3600, Math.floor(httpDays * 24 * 3600));
const wsTTL    = Math.max(24 * 3600, Math.floor(wsDays * 24 * 3600));

await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : {});
const db = mongoose.connection.db;

async function ensureTTL(collName, indexName, seconds) {
  try {
    const cmd = { collMod: collName, index: { name: indexName, expireAfterSeconds: seconds } };
    const res = await db.command(cmd);
    console.log(`✅ TTL modificado ${collName}.${indexName} → ${seconds}s`, res?.ok === 1 ? 'OK' : res);
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.includes('Index not found')) {
      const r = await db.collection(collName).createIndex({ ts: 1 }, { expireAfterSeconds: seconds, name: indexName });
      console.log(`ℹ️ Índice creado ${collName}.${indexName} → ${seconds}s`, r);
      return;
    }
    if (msg.includes('IndexOptionsConflict')) {
      try {
        await db.collection(collName).dropIndex(indexName);
        const r = await db.collection(collName).createIndex({ ts: 1 }, { expireAfterSeconds: seconds, name: indexName });
        console.log(`🔁 TTL recreado ${collName}.${indexName} → ${seconds}s`, r);
        return;
      } catch (e2) {
        console.error('❌ No se pudo recrear TTL', collName, indexName, e2?.message || e2);
        process.exit(1);
      }
    }
    console.error('❌ Error actualizando TTL', collName, indexName, msg);
    process.exit(1);
  }
}

await ensureTTL('apm_http', 'apm_http_ttl', httpTTL);
await ensureTTL('apm_ws', 'apm_ws_ttl', wsTTL);

await mongoose.disconnect();
console.log('✅ APM TTL actualizado');

