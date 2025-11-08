import fs from 'fs/promises';
import path from 'path';
import logger from '#config/logger.js';
import { getS3Client, getS3Bucket, uploadObject, getObject } from './objectStorage.js';

const SNAPSHOT_MODE = (process.env.SNAPSHOT_STORAGE || '').toLowerCase();
const USE_R2 = SNAPSHOT_MODE === 'r2';

function buildKey(key) {
  const basePrefix = process.env.SNAPSHOT_PREFIX || 'metrics';
  return `${basePrefix.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
}

export async function saveSnapshot({ key, buffer, localPath }) {
  if (USE_R2) {
    const client = getS3Client();
    if (!client) throw new Error('R2 client not configured for snapshot storage');
    const finalKey = buildKey(key);
    await uploadObject({
      Key: finalKey,
      Body: buffer,
      ContentEncoding: 'gzip',
      ContentType: 'application/json',
    });
    return { location: `s3://${getS3Bucket()}/${finalKey}` };
  }

  if (!localPath) throw new Error('localPath is required when SNAPSHOT_STORAGE is not r2');
  await ensureDir(path.dirname(localPath));
  await fs.writeFile(localPath, buffer);
  return { location: localPath };
}

export async function readSnapshot({ key, localPath }) {
  if (USE_R2) {
    const client = getS3Client();
    if (!client) throw new Error('R2 client not configured for snapshot storage');
    const finalKey = buildKey(key);
    try {
      const res = await getObject({ Key: finalKey });
      const chunks = [];
      for await (const chunk of res.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      const code = error?.name || error?.Code || error?.code;
      const status = error?.$metadata?.httpStatusCode;
      const message = error?.message || error;
      if (code === 'NoSuchKey' || status === 404) {
        logger.warn('[snapshotStorage] Snapshot not found in R2', { key: finalKey, error: message, code, status });
      } else {
        logger.error('[snapshotStorage] Failed to read snapshot from R2', { key: finalKey, error: message, code, status });
      }
      return null;
    }
  }

  if (!localPath) return null;
  try {
    return await fs.readFile(localPath);
  } catch (error) {
    const message = error?.message || error;
    if (error?.code === 'ENOENT') {
      logger.warn('[snapshotStorage] Snapshot file not found on disk', { path: localPath, error: message });
    } else {
      logger.error('[snapshotStorage] Failed to read snapshot from disk', { path: localPath, error: message, code: error?.code });
    }
    return null;
  }
}

