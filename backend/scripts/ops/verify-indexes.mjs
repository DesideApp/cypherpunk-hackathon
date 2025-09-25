import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = process.env.MONGO_DB_NAME || undefined;

function fmtIdx(i) {
  const keys = Object.entries(i.key).map(([k,v]) => `${k}:${v}`).join(',');
  const ttl  = i.expireAfterSeconds != null ? `, TTL=${i.expireAfterSeconds}s` : '';
  const uniq = i.unique ? ', unique' : '';
  return `${i.name} [${keys}${ttl}${uniq}]`;
}

await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : {});
const cols = await mongoose.connection.db.listCollections().toArray();
console.log('🔍 Colecciones:', cols.map(c => c.name).sort().join(', '), '\n');
for (const { name } of cols) {
  const idx = await mongoose.connection.db.collection(name).indexes();
  console.log(`📁 ${name}:`);
  for (const i of idx) console.log(`  - ${fmtIdx(i)}`);
  console.log();
}
console.log('✅ verify-indexes OK');
await mongoose.disconnect();
