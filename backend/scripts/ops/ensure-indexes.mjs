import mongoose from 'mongoose';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'modules');
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = process.env.MONGO_DB_NAME || undefined;

async function importAllModels(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await importAllModels(p);
    else if (e.isFile() && e.name.endsWith('.js') && p.includes(`${path.sep}models${path.sep}`)) {
      await import(pathToFileURL(p).href);
    }
  }
}

await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : {});
await importAllModels(root);
// Skip apm collections (handled by update-apm-ttl)
mongoose.deleteModel('APMHttp');
mongoose.deleteModel('APMWs');
await Promise.all(mongoose.modelNames().map(n => mongoose.model(n).ensureIndexes()));
console.log('✅ ensure-indexes OK:', mongoose.modelNames());
await mongoose.disconnect();
