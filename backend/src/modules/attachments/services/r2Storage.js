import { S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '#config/appConfig.js';
import logger from '#config/logger.js';

let client;

function getClient() {
  if (client) return client;

  const { endpoint, accessKeyId, secretAccessKey } = config.attachmentVault;

  client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  return client;
}

function buildKey(key) {
  const prefix = config.attachmentVault.prefix?.replace(/\/+$/, '') || '';
  if (!key) return prefix;
  return prefix ? `${prefix}/${key}` : key;
}

export async function createPresignedUpload({ key, contentType, expiresInSeconds }) {
  const bucket = config.attachmentVault.bucket;
  if (!bucket) throw new Error('attachment-vault-bucket-missing');

  const storageKey = buildKey(key);
  const putCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: contentType || 'application/octet-stream',
  });

  const url = await getSignedUrl(getClient(), putCommand, {
    expiresIn: expiresInSeconds ?? config.attachmentVault.uploadUrlTtlSeconds,
  });

  return {
    bucket,
    key: storageKey,
    contentType: contentType || 'application/octet-stream',
    uploadUrl: url,
  };
}

export async function createPresignedDownload({ key, expiresInSeconds }) {
  const bucket = config.attachmentVault.bucket;
  if (!bucket) throw new Error('attachment-vault-bucket-missing');

  const resolvedKey = key?.startsWith(config.attachmentVault.prefix || '') ? key : buildKey(key);

  const getCommand = new GetObjectCommand({
    Bucket: bucket,
    Key: resolvedKey,
  });

  const url = await getSignedUrl(getClient(), getCommand, {
    expiresIn: expiresInSeconds ?? config.attachmentVault.uploadUrlTtlSeconds,
  });

  return url;
}

export async function deleteObject({ key }) {
  const bucket = config.attachmentVault.bucket;
  if (!bucket) throw new Error('attachment-vault-bucket-missing');
  if (!key) return;

  try {
    await getClient().send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key?.startsWith(config.attachmentVault.prefix || '') ? key : buildKey(key),
    }));
  } catch (error) {
    logger.warn('attachment_delete_failed', {
      key,
      error: error?.message || error,
    });
    throw error;
  }
}

export async function headObject({ key }) {
  const bucket = config.attachmentVault.bucket;
  if (!bucket) throw new Error('attachment-vault-bucket-missing');
  if (!key) return null;

  try {
    const response = await getClient().send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key?.startsWith(config.attachmentVault.prefix || '') ? key : buildKey(key),
    }));
    return response;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

export { buildKey };
