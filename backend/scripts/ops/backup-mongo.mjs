#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import process from 'process';
import { PassThrough } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { fileURLToPath } from 'url';
import { getS3Client, getS3Bucket, listObjects, deleteObject } from '../../src/shared/services/objectStorage.js';
import { createModuleLogger } from '../../src/config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = createModuleLogger({ module: 'ops.backupMongo' });

function assertEnv(name, value) {
  if (!value) {
    log.error(`Missing required env var ${name}`);
    process.exit(1);
  }
}

function buildKey(timestamp) {
  const env = process.env.BACKUP_ENV || process.env.NODE_ENV || 'dev';
  const date = new Date(timestamp);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hhmm = String(date.getUTCHours()).padStart(2, '0') + String(date.getUTCMinutes()).padStart(2, '0');
  const ts = date.toISOString().replace(/[:.]/g, '').slice(0, 15);
  return `backups/${env}/mongo/${yyyy}/${mm}/${dd}/dump-${ts}-${hhmm}.archive.gz`;
}

async function uploadToS3({ key, stream, size }) {
  const client = getS3Client();
  assertEnv('R2 config', client);

  const bucket = getS3Bucket();
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: 'application/gzip',
    },
  });

  await upload.done();
  log.info('backup_uploaded', { key, bucket, sizeBytes: size ?? null });
}

function runMongodump() {
  const args = ['--archive', '--gzip', `--uri=${process.env.MONGO_URI}`];
  if (process.env.MONGO_DB_NAME) {
    args.push(`--db=${process.env.MONGO_DB_NAME}`);
  }
  if (process.env.MONGODUMP_ARGS) {
    args.push(...process.env.MONGODUMP_ARGS.split(/\s+/).filter(Boolean));
  }

  log.info('mongodump_start', { args: args.filter(a => !a.includes('uri=')) });
  const child = spawn('mongodump', args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    cwd: __dirname,
  });
  return child;
}

async function cleanupOldBackups(prefix) {
  const daysRaw = process.env.BACKUP_RETENTION_DAYS;
  if (!daysRaw) return;

  const retentionMs = Number(daysRaw) * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(retentionMs) || retentionMs <= 0) return;

  const client = getS3Client();
  if (!client) return;

  const now = Date.now();
  let continuationToken;
  let removed = 0;

  do {
    const res = await listObjects({
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const contents = res.Contents || [];
    for (const obj of contents) {
      const lastModified = obj.LastModified ? new Date(obj.LastModified).getTime() : null;
      if (lastModified && now - lastModified > retentionMs) {
        await deleteObject({ Key: obj.Key });
        removed += 1;
        log.info('backup_deleted', { key: obj.Key });
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : null;
  } while (continuationToken);

  if (removed > 0) {
    log.info('backup_retention_complete', { removed });
  }
}

async function main() {
  assertEnv('MONGO_URI', process.env.MONGO_URI);
  assertEnv('R2_BUCKET', process.env.R2_BUCKET);

  const timestamp = Date.now();
  const key = buildKey(timestamp);

  const child = runMongodump();
  const pass = new PassThrough();
  let uploadError = null;

  const uploadPromise = uploadToS3({ key, stream: pass });
  child.stdout.pipe(pass);

  child.on('error', (err) => {
    uploadError = err;
    log.error('mongodump_spawn_failed', { error: err?.message || err });
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    log.error('mongodump_failed', { exitCode });
    process.exit(exitCode || 1);
  }

  try {
    await uploadPromise;
  } catch (err) {
    log.error('backup_upload_failed', { error: err?.message || err });
    process.exit(1);
  }

  const envPrefix = `backups/${process.env.BACKUP_ENV || process.env.NODE_ENV || 'dev'}/mongo/`;
  await cleanupOldBackups(envPrefix);
}

main().catch((err) => {
  log.error('backup_unhandled_error', { error: err?.message || err });
  process.exit(1);
});

