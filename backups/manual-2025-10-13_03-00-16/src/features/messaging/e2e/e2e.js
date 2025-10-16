// src/features/messaging/e2e/e2e.js
// E2E mínimo usando Web Crypto (AES-GCM). Gestión de claves simétricas por conversación.

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ---------- Utils ----------
function isBufferSource(x) {
  return x && (x instanceof ArrayBuffer || ArrayBuffer.isView(x));
}

// Normaliza a bytes (BufferSource) o undefined
function toBytes(x) {
  if (isBufferSource(x)) return x;
  return x == null ? undefined : textEncoder.encode(String(x));
}

function abToB64(bytes) {
  let binary = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}
function b64ToAb(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Hash → HEX (el nombre "sha256Bytes" era confuso; devolvía HEX)
async function sha256HexImpl(buffer) {
  const out = await crypto.subtle.digest('SHA-256', buffer);
  const arr = new Uint8Array(out);
  let hex = '';
  for (const b of arr) hex += b.toString(16).padStart(2, '0');
  return hex;
}
export const sha256Hex = sha256HexImpl; // API estable

export async function generateConversationKey() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return { key, rawBase64: abToB64(raw) };
}

export async function importConversationKey(rawBase64) {
  const raw = b64ToAb(rawBase64);
  const key = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  return key;
}

// Serializa el AAD en el sobre para poder descifrar siempre.
// - Si AAD es string → envelope.aad (string)  (compatible con lo existente)
// - Si AAD es BufferSource → envelope.aadB64  (nuevo campo)
function serializeAadForEnvelope(aad) {
  if (aad == null) return { aad: null, aadB64: null };
  if (typeof aad === 'string') return { aad, aadB64: null };
  if (isBufferSource(aad)) return { aad: null, aadB64: abToB64(aad instanceof ArrayBuffer ? aad : aad.buffer) };
  // fallback a string
  return { aad: String(aad), aadB64: null };
}

function aadBytesFromEnvelope(envelope) {
  if (envelope?.aadB64) return b64ToAb(envelope.aadB64);
  if (envelope?.aad != null) return toBytes(envelope.aad);
  return undefined; // sin AAD
}

// Cifra un objeto JSON { type, text, meta } o similar
export async function encryptPayload(obj, key, aad /* opcional (string|bytes) */) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(obj));

  const additionalData = aad == null ? undefined : toBytes(aad);
  const params = additionalData
    ? { name: 'AES-GCM', iv, additionalData }
    : { name: 'AES-GCM', iv };

  const enc = await crypto.subtle.encrypt(params, key, plaintext);
  const { aad: aadStr, aadB64 } = serializeAadForEnvelope(aad);

  return {
    iv: abToB64(iv),
    cipher: abToB64(enc),
    // Mantener compatibilidad: si era string, seguimos exponiendo 'aad'
    aad: aadStr,
    // Nuevo campo cuando el AAD era binario
    aadB64: aadB64,
  };
}

export async function decryptPayload(envelope, key) {
  try {
    const iv = new Uint8Array(b64ToAb(envelope.iv));
    const cipherBuf = b64ToAb(envelope.cipher);
    const additionalData = aadBytesFromEnvelope(envelope);

    const params = additionalData
      ? { name: 'AES-GCM', iv, additionalData }
      : { name: 'AES-GCM', iv };

    const dec = await crypto.subtle.decrypt(params, key, cipherBuf);
    const json = textDecoder.decode(dec);
    return JSON.parse(json);
  } catch (err) {
    // Mejora de trazabilidad
    const e = new Error('[E2EE] decrypt failed');
    e.cause = err;
    e.meta = {
      hasAad: !!envelope?.aad || !!envelope?.aadB64,
      aadIsB64: !!envelope?.aadB64,
      ivLen: envelope?.iv ? atob(envelope.iv).length : 0,
      cipherLen: envelope?.cipher ? atob(envelope.cipher).length : 0,
    };
    throw e;
  }
}

// ID determinista de mensaje según sobre cifrado (iv+cipher)
export async function deriveMessageId(envelope) {
  const ivBuf = b64ToAb(envelope.iv);
  const cBuf = b64ToAb(envelope.cipher);
  const uIv = new Uint8Array(ivBuf);
  const uC = new Uint8Array(cBuf);
  const concat = new Uint8Array(uIv.length + uC.length);
  concat.set(uIv, 0);
  concat.set(uC, uIv.length);
  return sha256Hex(concat.buffer);
}

// -------- Texto --------
export async function encryptText(text, key, metaOrAad) {
  let meta = null;
  let aad = undefined;
  if (metaOrAad != null) {
    if (typeof metaOrAad === 'string' || isBufferSource(metaOrAad)) {
      aad = metaOrAad;
    } else {
      meta = metaOrAad;
    }
  }
  return encryptPayload({ type: 'text', text, meta }, key, aad);
}
export async function decryptToText(envelope, key) {
  const obj = await decryptPayload(envelope, key);
  if (obj && obj.type === 'text') return obj;
  return obj;
}

// -------- Binario por chunk --------
export async function encryptBinaryChunk(arrayBuffer, key, aad /* opcional */) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = aad == null ? undefined : toBytes(aad);
  const params = additionalData
    ? { name: 'AES-GCM', iv, additionalData }
    : { name: 'AES-GCM', iv };

  const enc = await crypto.subtle.encrypt(params, key, arrayBuffer);
  const { aad: aadStr, aadB64 } = serializeAadForEnvelope(aad);

  return {
    iv: abToB64(iv),
    cipher: abToB64(enc),
    aad: aadStr,
    aadB64,
  };
}

// Divide un Uint8Array en chunks fijos
export function splitIntoChunks(u8, chunkSize) {
  const out = [];
  if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
  for (let i = 0; i < u8.length; i += chunkSize) {
    out.push(u8.subarray(i, Math.min(i + chunkSize, u8.length)));
  }
  return out;
}

// --- ECDH efímero (P-256, WebCrypto) ---
export async function generateEphemeralKeyPair() {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const rawPub = await crypto.subtle.exportKey('raw', kp.publicKey); // 65 bytes, uncompressed
  return { pubB64: abToB64(rawPub), priv: kp.privateKey };
}

export async function deriveSharedSecret(privKey, peerPubB64) {
  const raw = b64ToAb(peerPubB64);
  const peerPubKey = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPubKey }, privKey, 256);
  return new Uint8Array(bits); // 32 bytes
}

// --- Derivar 32B de sesión (MVP: hash con etiqueta) ---
export async function deriveSessionKeyBytes(sharedSecretU8, info = 'deside:convKey') {
  const enc = new TextEncoder();
  const infoBytes = enc.encode(info);
  const data = new Uint8Array(sharedSecretU8.length + infoBytes.length);
  data.set(sharedSecretU8, 0);
  data.set(infoBytes, sharedSecretU8.length);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(buf); // 32 bytes
}
