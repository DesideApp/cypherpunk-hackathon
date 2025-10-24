import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ALLOWED_MIME = new Set(['image/webp', 'image/png', 'image/jpeg']);

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const b64 = m[2];
  return { mime, b64 };
}

function extFromMime(mime) {
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  return '';
}

export async function uploadAvatar(req, res) {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: 'UNAUTHORIZED', nextStep: 'REAUTHENTICATE' });

    const { dataUrl } = req.body || {};
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return res.status(400).json({ error: 'INVALID_DATA_URL', nextStep: 'CHECK_INPUT' });
    if (!ALLOWED_MIME.has(parsed.mime)) return res.status(400).json({ error: 'UNSUPPORTED_MIME', nextStep: 'USE_WEBP_PNG_JPEG' });

    // Limit ~1.5MB (base64 length). 2MB base64 ≈ 1.5MB binary
    if (parsed.b64.length > 2_000_000) {
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', nextStep: 'REDUCE_IMAGE' });
    }

    const buf = Buffer.from(parsed.b64, 'base64');

    // Resolve to backend/public/uploads/avatars independent of CWD
    const here = path.dirname(fileURLToPath(import.meta.url));
    // controllers/ -> uploads/ -> modules/ -> src/ -> backend/
    const publicRoot = path.resolve(here, '../../../..', 'public');
    const uploadsDir = path.join(publicRoot, 'uploads', 'avatars');

    fs.mkdirSync(uploadsDir, { recursive: true });

    const ext = extFromMime(parsed.mime) || '.webp';
    const filename = `${wallet}-${Date.now()}${ext}`;
    const outPath = path.join(uploadsDir, filename);

    await fs.promises.writeFile(outPath, buf);

    // Public URL path (served from /public)
    const urlPath = `/uploads/avatars/${filename}`;
    return res.status(200).json({ url: urlPath });
  } catch (err) {
    console.error('❌ uploadAvatar error:', err);
    return res.status(500).json({ error: 'UPLOAD_FAILED', nextStep: 'RETRY' });
  }
}
