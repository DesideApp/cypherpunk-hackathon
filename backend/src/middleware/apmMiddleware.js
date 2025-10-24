import mongoose from 'mongoose';

function sanitizeRoute(path) {
  if (!path) return '/';
  let p = String(path);
  // Replace 24-hex ids and UUIDs
  p = p.replace(/[a-f0-9]{24}/gi, ':id');
  p = p.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
  // Replace base58-like pubkeys (32..44 chars)
  p = p.replace(/[1-9A-HJ-NP-Za-km-z]{32,44}/g, ':key');
  return p;
}

export function apmMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  const method = req.method;
  const routeRaw = req.route?.path || req.path || req.originalUrl || '/';
  const route = sanitizeRoute(routeRaw);
  const wallet = req.user?.wallet || null;
  const userAgent = req.headers['user-agent'] || null;
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString();
  const bytesIn = Number(req.headers['content-length'] || 0) || 0;

  // Count response bytes
  let bytesOut = 0;
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  res.write = function (chunk, encoding, cb) {
    if (chunk) bytesOut += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
    return origWrite(chunk, encoding, cb);
  };
  res.end = function (chunk, encoding, cb) {
    if (chunk) bytesOut += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
    return origEnd(chunk, encoding, cb);
  };

  res.on('finish', async () => {
    try {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      const status = res.statusCode || 0;
      const doc = {
        ts: new Date(),
        method,
        route,
        status,
        durationMs: Math.max(0, Math.round(durationMs)),
        bytesIn,
        bytesOut,
        wallet,
        userAgent,
        ip,
      };
      const db = mongoose.connection?.db;
      if (db) {
        await db.collection('apm_http').insertOne(doc);
      }
    } catch (e) {
      // swallow errors silently
    }
  });

  next();
}

export default apmMiddleware;

