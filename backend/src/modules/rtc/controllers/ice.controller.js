// src/modules/rtc/controllers/ice.controller.js
import crypto from 'node:crypto';
export async function getIceServers(req, res) {
  try {
    // Provider: 'twilio' (default) o 'coturn'
    const provider = String(process.env.RTC_PROVIDER || process.env.rtc_provider || 'twilio').toLowerCase();
    const ttlRaw = parseInt(process.env.TURN_CRED_TTL || '600', 10);
    const ttl = Math.max(60, Math.min(3600, Number.isFinite(ttlRaw) ? ttlRaw : 600));
    const now = Math.floor(Date.now() / 1000);

    // Cache-Control configurable: por defecto no-store
    const cacheMaxAge = parseInt(process.env.ICE_CACHE_MAX_AGE || '0', 10);
    const setCache = () => {
      if (Number.isFinite(cacheMaxAge) && cacheMaxAge > 0) {
        res.setHeader('Cache-Control', `private, max-age=${cacheMaxAge}`);
      } else {
        res.setHeader('Cache-Control', 'private, no-store');
      }
    };

    if (provider === 'coturn') {
      const TURN_SECRET = process.env.TURN_SECRET;
      const TURN_URIS = (process.env.TURN_URIS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const STUN_FALLBACK = (process.env.TURN_STUN_FALLBACK || '').trim();

      if (!TURN_SECRET || TURN_URIS.length === 0) {
        console.warn('[rtc.ice] coturn config incomplete: missing TURN_SECRET or TURN_URIS');
        return res.status(503).json({ error: 'ice_unavailable', provider: 'coturn' });
      }

      // Static auth secret: username = exp[:subject], password = base64(hmac-sha1(secret, username))
      const exp = now + ttl;
      const subject = req.user?.wallet || 'anon';
      const username = `${exp}:${subject}`;
      const hmac = crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64');
      const password = hmac;

      const iceServers = [];
      if (STUN_FALLBACK) {
        iceServers.push({ urls: STUN_FALLBACK });
      }
      iceServers.push({ urls: TURN_URIS, username, credential: password });

      // Log discreto (sin credenciales ni URIs)
      console.info('[rtc.ice]', {
        user: req.user?.wallet || 'anon',
        provider: 'coturn',
        urisCount: TURN_URIS.length,
        ttl,
      });

      setCache();
      return res.status(200).json({
        iceServers,
        ttl,
        serverTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        provider: 'coturn',
        issuedAt: now
      });
    }

    // Twilio (Network Traversal API)
    const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_REGION } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET) {
      return res.status(503).json({ error: 'ice_unavailable', nextStep: 'CONTACT_ADMIN' });
    }

    const base = (TWILIO_REGION ? `${TWILIO_REGION}.` : '') + 'api.twilio.com';
    const url = `https://${base}/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Tokens.json`;
    const auth = 'Basic ' + Buffer.from(`${TWILIO_API_KEY}:${TWILIO_API_SECRET}`).toString('base64');

    // Timeout defensivo (4s por defecto configurable)
    const controller = new AbortController();
    const toMs = parseInt(process.env.ICE_UPSTREAM_TIMEOUT_MS || '4000', 10) || 4000;
    const timer = setTimeout(() => controller.abort(), toMs);

    try {
      const r = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: auth,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(TWILIO_REGION ? { 'X-Twilio-Region': TWILIO_REGION } : {}),
        },
        body: new URLSearchParams({ Ttl: String(ttl) }),
      });

      if (!r.ok) {
        return res.status(503).json({ error: 'ice_unavailable', status: r.status, provider: 'twilio' });
      }

      const data = await r.json();
      const iceServers = Array.isArray(data?.ice_servers) ? data.ice_servers : [];

      // Log discreto (sin credenciales)
      console.info('[rtc.ice]', {
        user: req.user?.wallet || 'anon',
        provider: 'twilio',
        region: TWILIO_REGION || 'us1',
        ttl,
      });

      setCache();
      return res.status(200).json({
        iceServers,
        ttl,
        serverTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        provider: 'twilio',
        region: TWILIO_REGION || 'us1',
        issuedAt: now
      });
    } catch (e) {
      const aborted = e?.name === 'AbortError';
      console.error('❌ /api/rtc/ice twilio error:', aborted ? 'timeout' : (e?.message || e));
      return res.status(503).json({ error: 'ice_unavailable', provider: 'twilio' });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.error('❌ /api/rtc/ice error:', e?.message || e);
    return res.status(500).json({ error: 'failed_to_issue_ice' });
  }
}
