import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

let cachedClient = null;

export function getS3Bucket() {
  return process.env.R2_BUCKET || null;
}

export function getS3Client() {
  const bucket = getS3Bucket();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return cachedClient;
}

export async function uploadObject(params) {
  const client = getS3Client();
  if (!client) throw new Error('S3 client not configured (check R2_* envs)');
  const bucket = params.Bucket || getS3Bucket();
  const command = new PutObjectCommand({ ...params, Bucket: bucket });
  await client.send(command);
}

export async function getObject(params) {
  const client = getS3Client();
  if (!client) throw new Error('S3 client not configured (check R2_* envs)');
  const bucket = params.Bucket || getS3Bucket();
  const command = new GetObjectCommand({ ...params, Bucket: bucket });
  return client.send(command);
}

export async function deleteObject(params) {
  const client = getS3Client();
  if (!client) throw new Error('S3 client not configured (check R2_* envs)');
  const bucket = params.Bucket || getS3Bucket();
  const command = new DeleteObjectCommand({ ...params, Bucket: bucket });
  await client.send(command);
}

export async function listObjects(params) {
  const client = getS3Client();
  if (!client) throw new Error('S3 client not configured (check R2_* envs)');
  const bucket = params.Bucket || getS3Bucket();
  const command = new ListObjectsV2Command({ ...params, Bucket: bucket });
  return client.send(command);
}

