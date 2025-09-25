// src/features/messaging/services/attachments.js
// Particionado y cifrado de adjuntos por chunks usando AES-GCM con AAD estable.

import { encryptPayload, decryptPayload } from '../e2e/e2e.js';

export const DEFAULT_CHUNK = 512 * 1024; // ~512 KB

function sliceFile(file, start, end) {
  return file.slice(start, end);
}
function readAsArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error || new Error('FileReader error'));
    fr.onload = () => resolve(fr.result);
    fr.readAsArrayBuffer(blob);
  });
}
async function sha256Hex(buffer) {
  const out = await crypto.subtle.digest('SHA-256', buffer);
  const arr = new Uint8Array(out);
  let hex = '';
  for (const b of arr) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// Hash completo del archivo (MVP)
export async function computeFileHash(file) {
  const buf = await readAsArrayBuffer(file);
  return sha256Hex(buf);
}

/**
 * Genera un AAD determinista por chunk. Debe coincidir EXACTO en decrypt.
 * Mantiene el formato que ya usabas, pero parametrizado con manifest.
 */
function makeChunkAAD(manifest, index) {
  return `chunk:${index}/${manifest.totalChunks}|name:${manifest.name}|size:${manifest.size}`;
}

/**
 * Prepara chunks cifrados (no sube). Devuelve { manifest, chunks[] }
 * Cada chunk incluye SIEMPRE su 'aad' para que el receptor no tenga que
 * reconstruir a ciegas (evita "hasAad:false, aadRebuilt:true").
 */
export async function prepareEncryptedChunks(file, key, opts) {
  if (!file) throw new Error('file requerido');
  if (!key) throw new Error('key requerida');

  const chunkSize = (opts && opts.chunkSize) || DEFAULT_CHUNK;
  const total = Math.max(1, Math.ceil(file.size / chunkSize));
  const sha256 = await computeFileHash(file);

  const manifest = {
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    totalChunks: total,
    chunkSize,
    sha256,
    version: 1,
  };

  const chunks = [];
  for (let i = 0; i < total; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const slice = sliceFile(file, start, end);
    const ab = await readAsArrayBuffer(slice);

    // AAD determinista y estable
    const aad = makeChunkAAD(manifest, i);

    const envelope = await encryptPayload(
      { type: 'bin', binBase64: arrayBufferToBase64(ab) },
      key,
      aad
    );

    // ⚠️ Garantizamos persistir el AAD junto al sobre cifrado
    chunks.push({
      index: i,
      iv: envelope.iv,
      cipher: envelope.cipher,
      aad, // persistido explícitamente
    });
  }

  return { manifest, chunks };
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Reconstruye File a partir de chunks cifrados descargados.
 * Si algún chunk viene sin 'aad', lo recomponemos de forma determinista
 * para evitar fallos de descifrado por AAD ausente.
 */
export async function assembleDecryptedFile(manifest, encryptedChunks, key) {
  if (!manifest || !encryptedChunks || !Array.isArray(encryptedChunks)) {
    throw new Error('parámetros inválidos');
  }
  if (!key) throw new Error('key requerida');

  // Ordenamos por index por si llegan desordenados
  const sorted = [...encryptedChunks].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const parts = [];
  for (const ch of sorted) {
    const aad = ch.aad || makeChunkAAD(manifest, ch.index);
    const obj = await decryptPayload(
      { iv: ch.iv, cipher: ch.cipher, aad },
      key
    );
    if (!obj || obj.type !== 'bin' || !obj.binBase64) {
      throw new Error(`Invalid chunk payload (index ${ch.index})`);
    }
    parts.push(new Uint8Array(base64ToArrayBuffer(obj.binBase64)));
  }

  const blob = new Blob(parts, { type: manifest.mime || 'application/octet-stream' });
  // `File` no existe en algunos runtimes (p.ej. older Safari Workers). Fallback a Blob.
  try {
    return new File([blob], manifest.name || 'attachment.bin', {
      type: manifest.mime || 'application/octet-stream',
    });
  } catch {
    blob.name = manifest.name || 'attachment.bin'; // best-effort
    return blob;
  }
}

/**
 * Prepara adjuntos pequeños inline base64 (WritingPanel/useMessaging).
 * Devuelve { base64, mime, kind, w?, h?, durMs? }
 */
export async function prepareInlineAttachment(
  file,
  { maxInlineBytes = 512 * 1024 } = {}
) {
  if (!file) throw new Error('file requerido');
  if (file.size > maxInlineBytes) throw new Error('too-large-for-inline');

  const ab = await readAsArrayBuffer(file);
  const base64 = arrayBufferToBase64(ab);

  const mime = file.type || 'application/octet-stream';
  let kind = 'file';
  if (mime.startsWith('image/')) kind = 'image';
  else if (mime.startsWith('video/')) kind = 'video';
  else if (mime.startsWith('audio/')) kind = 'audio';

  return {
    base64,
    mime,
    kind,
    w: file.width || undefined,
    h: file.height || undefined,
    durMs: file.durationMs || undefined,
  };
}
