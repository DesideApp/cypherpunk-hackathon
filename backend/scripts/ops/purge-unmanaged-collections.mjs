// Purge collections in the configured DB that are NOT managed by this backend's Mongoose models.
// - Dry-run by default: prints what would be dropped
// - Apply mode: pass --apply AND set env PURGE_CONFIRM=I_UNDERSTAND
// - It imports all model files under src/modules/**/models/*.model.js to compute the allowlist dynamically.
// - Only affects the database selected via MONGO_URI + optional MONGO_DB_NAME

import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs/promises';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..', '..'); // backend/
const MODELS_ROOT = path.join(ROOT, 'src', 'modules');

// Load env in a robust way:
// 1) default (.env in CWD if any)
// 2) backend/.env
// 3) repo-root/.env (one level up)
dotenv.config();
dotenv.config({ path: path.resolve(ROOT, '.env') });
dotenv.config({ path: path.resolve(ROOT, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || undefined;
const APPLY = process.argv.includes('--apply');
const CONFIRM = process.env.PURGE_CONFIRM === 'I_UNDERSTAND';

function log(...args) { console.log('[purge]', ...args); }
function err(...args) { console.error('[purge]', ...args); }

if (!MONGO_URI) {
  err('❌ MONGO_URI is required');
  process.exit(1);
}

async function importAllModels(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await importAllModels(p);
    } else if (e.isFile() && e.name.endsWith('.js') && p.includes(`${path.sep}models${path.sep}`)) {
      await import(pathToFileURL(p).href);
    }
  }
}

function computeAllowedCollections() {
  const names = mongoose.modelNames();
  const allowed = new Set();
  for (const n of names) {
    const m = mongoose.model(n);
    const col = m.collection?.collectionName;
    if (col) allowed.add(col);
  }
  return allowed;
}

function shouldIgnoreCollection(name) {
  // System/internal collections to never drop here
  if (name.startsWith('system.')) return true;
  // Add any other known-safe ignores here if needed
  return false;
}

try {
  const connOpts = DB_NAME ? { dbName: DB_NAME } : {};
  log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI, connOpts);

  log('Importing models to build allowlist…');
  await importAllModels(MODELS_ROOT);

  const allowed = computeAllowedCollections();
  if (allowed.size === 0) {
    err('❌ No models discovered. Aborting to avoid accidental mass deletion.');
    process.exit(2);
  }

  const db = mongoose.connection.db;
  const currentDbName = db.databaseName;
  const cols = await db.listCollections().toArray();
  const allNames = cols.map(c => c.name).sort();

  const managed = [];
  const unmanaged = [];
  for (const name of allNames) {
    if (shouldIgnoreCollection(name)) continue; // neither in managed nor unmanaged
    if (allowed.has(name)) managed.push(name);
    else unmanaged.push(name);
  }

  const summary = {
    db: currentDbName,
    allowedFromModels: Array.from(allowed).sort(),
    existingCollections: allNames,
    managedCollections: managed,
    unmanagedCollections: unmanaged,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    log('Dry-run only. Nothing was dropped.');
    process.exit(0);
  }

  if (!CONFIRM) {
    err('❌ --apply requires env PURGE_CONFIRM=I_UNDERSTAND');
    process.exit(3);
  }

  if (unmanaged.length === 0) {
    log('No unmanaged collections to drop.');
    process.exit(0);
  }

  log(`Dropping ${unmanaged.length} unmanaged collections in DB "${currentDbName}"…`);
  const results = [];
  for (const name of unmanaged) {
    try {
      const ok = await db.collection(name).drop();
      results.push({ name, dropped: !!ok });
      log(`Dropped: ${name}`);
    } catch (e) {
      results.push({ name, dropped: false, error: e?.message || String(e) });
      err(`Failed to drop ${name}:`, e?.message || e);
    }
  }

  console.log(JSON.stringify({ dropped: results }, null, 2));
  process.exit(0);
} catch (e) {
  err('Unhandled error:', e?.stack || e);
  process.exit(99);
} finally {
  try { await mongoose.disconnect(); } catch {}
}
