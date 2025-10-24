// #shared/services/websocketServer.js
import { Server as WebSocketServer } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import logger from '#config/logger.js';

import Contact from '#modules/contacts/models/contact.model.js';
import { ContactStatus } from '#modules/contacts/contact.constants.js';
import User from '#modules/users/models/user.model.js';
import RelayMessage from '#modules/relay/models/relayMessage.model.js';
import APMWs from '#modules/stats/models/apmWs.model.js';
import { getPublicKey } from '#shared/services/keyManager.js';
import { COOKIE_NAMES } from '#config/cookies.js';

dotenv.config();
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

// Toggle de compatibilidad para presencia legacy: presence y user_connected/user_disconnected
// Fase 2: por defecto deshabilitado; puede habilitarse con PRESENCE_LEGACY_EMIT=true
const PRESENCE_LEGACY_EMIT = String(process.env.PRESENCE_LEGACY_EMIT ?? 'false').toLowerCase() === 'true';

// TTL de presencia desde env var (default 45 segundos)
const PRESENCE_TTL_MS = parseInt(process.env.PRESENCE_TTL_MS || '45000', 10);

let io;
const ACCESS_COOKIE_NAME = COOKIE_NAMES.accessToken;

// === presencia: wallet -> Set<socketId> ===
const connectionsByWallet = new Map();

// === presencia con TTL ===
const presenceTimestamps = new Map(); // wallet -> lastSeen timestamp

// Señales procesadas (idempotencia por signalId) con TTL simple
const SIGNAL_TTL_MS = 5 * 60 * 1000; // 5 minutos
const processedSignals = new Map(); // signalId -> timestamp

function _cleanupProcessedSignals(now = Date.now()) {
  // LRU pobre: purga por TTL y recorta tamaño máximo
  const MAX_ENTRIES = 5000;
  for (const [id, ts] of processedSignals.entries()) {
    if (now - ts > SIGNAL_TTL_MS) processedSignals.delete(id);
  }
  if (processedSignals.size > MAX_ENTRIES) {
    const toDelete = processedSignals.size - MAX_ENTRIES;
    let i = 0;
    for (const key of processedSignals.keys()) {
      processedSignals.delete(key);
      if (++i >= toDelete) break;
    }
  }
}

function isDuplicateSignal(signalId) {
  if (!signalId) return false;
  const now = Date.now();
  _cleanupProcessedSignals(now);
  return processedSignals.has(signalId);
}

function markSignalProcessed(signalId) {
  if (!signalId) return;
  processedSignals.set(signalId, Date.now());
}

function updatePresenceTimestamp(wallet) {
  presenceTimestamps.set(wallet, Date.now());
}

function isWalletOnlineWithTTL(wallet) {
  const lastSeen = presenceTimestamps.get(wallet);
  if (!lastSeen) return false;
  return (Date.now() - lastSeen) <= PRESENCE_TTL_MS;
}

function isRTCEligible(wallet) {
  const isOnline = isWalletOnlineWithTTL(wallet);
  const hasActiveConnections = connectionsByWallet.get(wallet)?.size > 0;
  return isOnline && hasActiveConnections;
}

function getLastHeartbeat(wallet) {
  return presenceTimestamps.get(wallet) || null;
}

async function broadcastPresenceUpdate(wallet, { reason = 'heartbeat' } = {}) {
  if (!io) return;
  try {
    const contacts = await getAcceptedContacts(wallet);
    const rtcEligible = isRTCEligible(wallet);
    const lastHeartbeat = getLastHeartbeat(wallet) || Date.now();
    const online = isWalletOnlineWithTTL(wallet);
    const payload = {
      pubkey: wallet,
      online,
      rtcEligible,
      ttl: PRESENCE_TTL_MS,
      lastHeartbeat,
      timestamp: Date.now(),
      reason
    };
    for (const w of contacts) {
      io.to(w).emit('presence:update', payload);
      // Legacy presence (compat opcional)
      if (PRESENCE_LEGACY_EMIT) {
        logger?.warn?.('[presence] legacy emit', { event: 'presence', pubkey: wallet, online, reason });
        io.to(w).emit('presence', { pubkey: wallet, online });
        if (reason === 'user_connected') {
          logger?.warn?.('[presence] legacy emit', { event: 'user_connected', pubkey: wallet });
          io.to(w).emit('user_connected', { pubkey: wallet });
        }
        if (reason === 'disconnected' || reason === 'ttl_expired') {
          logger?.warn?.('[presence] legacy emit', { event: 'user_disconnected', pubkey: wallet, reason });
          io.to(w).emit('user_disconnected', { pubkey: wallet });
        }
      } else {
        logger?.info?.('[presence] legacy suppressed', { pubkey: wallet, reason });
      }
    }
  } catch (e) {
    console.warn(`[Presence] broadcast error for ${wallet}:`, e?.message || e);
  }
}

// Limpiar presencias expiradas cada 30 segundos
setInterval(() => {
  const now = Date.now();
  for (const [wallet, lastSeen] of presenceTimestamps.entries()) {
    if (now - lastSeen > PRESENCE_TTL_MS) {
      presenceTimestamps.delete(wallet);
      // Emitir presencia offline a contactos (centralizado)
      broadcastPresenceUpdate(wallet, { reason: 'ttl_expired' });
    }
  }
}, 30000);

function trackJoin(pubkey, socketId) {
  let set = connectionsByWallet.get(pubkey);
  const wasEmpty = !set || set.size === 0;
  if (!set) {
    set = new Set();
    connectionsByWallet.set(pubkey, set);
  }
  set.add(socketId);
  return wasEmpty; // true si es la PRIMERA conexión
}

function trackLeave(pubkey, socketId) {
  const set = connectionsByWallet.get(pubkey);
  if (!set) return false; // si no había join previo, NO es última conexión
  set.delete(socketId);
  if (set.size === 0) {
    connectionsByWallet.delete(pubkey);
    return true; // era la ÚLTIMA conexión
  }
  return false;
}

async function getAcceptedContacts(wallet) {
  const [out, inn] = await Promise.all([
    Contact.find({ owner: wallet,  status: ContactStatus.ACCEPTED }, { contact: 1 }).lean(),
    Contact.find({ contact: wallet, status: ContactStatus.ACCEPTED }, { owner: 1 }).lean(),
  ]);
  const targets = new Set();
  for (const c of out) targets.add(c.contact);
  for (const c of inn) targets.add(c.owner);
  targets.delete(wallet);
  return Array.from(targets);
}

// Mutualidad de contactos (ambos aceptados)
async function areMutualContacts(a, b) {
  const [fwd, rev] = await Promise.all([
    Contact.exists({ owner: a, contact: b, status: ContactStatus.ACCEPTED }),
    Contact.exists({ owner: b, contact: a, status: ContactStatus.ACCEPTED }),
  ]);
  return Boolean(fwd && rev);
}

// --- utils handshake auth ---
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const items = cookieHeader.split(';');
  for (const it of items) {
    const idx = it.indexOf('=');
    if (idx === -1) continue;
    const k = it.slice(0, idx).trim();
    const v = decodeURIComponent(it.slice(idx + 1).trim());
    out[k] = v;
  }
  return out;
}

function getTokenFromHandshake(headers) {
  const auth = headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return { token: auth.slice(7).trim(), source: 'header' };
  }
  const cookies = parseCookies(headers?.cookie || headers?.Cookie);
  if (cookies?.[ACCESS_COOKIE_NAME]) return { token: cookies[ACCESS_COOKIE_NAME], source: 'cookie' };
  return { token: null, source: null };
}

function verifyJWT(token) {
  const PUBLIC_KEY = getPublicKey();
  if (!PUBLIC_KEY || typeof PUBLIC_KEY !== 'string' || PUBLIC_KEY.length < 100) {
    throw new Error('INVALID_PUBLIC_KEY');
  }
  const opts = {
    algorithms: ['RS256'],
    clockTolerance: 5,
  };
  if (process.env.JWT_ISSUER)   opts.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) opts.audience = process.env.JWT_AUDIENCE;
  return jwt.verify(token, PUBLIC_KEY, opts);
}

// --- simple WS rate limiter (token bucket por socket) ---
function makeLimiter({ windowMs = 10_000, max = 60 } = {}) {
  let count = 0;
  let windowStart = Date.now();
  return () => {
    const now = Date.now();
    if (now - windowStart > windowMs) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= max;
  };
}

async function loadChatHistory(pubkey, chatId, authData, options) {
  // TODO: implementar con RelayMessage o BackupModel cuando esté listo
  return [];
}

export default function createWebSocketServer(app) {
  const server = createServer(app);

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : [];

  io = new WebSocketServer(server, {
    transports: ['websocket'], // Solo WebSocket, no polling
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['x-wallet-signature', 'x-csrf-token', 'authorization', 'content-type'],
    },
    allowEIO3: true, // Compatibilidad
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  logger.info('[rtc] handlers:ready');

  io.on('connection', async (socket) => {
    // 1) Autenticación del handshake
    try {
      const { token } = getTokenFromHandshake(socket.handshake.headers || {});
      if (!token) {
        socket.emit('error', { error: 'unauthorized' });
        return socket.disconnect(true);
      }
      const decoded = verifyJWT(token);
      const walletFromToken = decoded.pubkey || decoded.wallet;
      if (!walletFromToken) {
        socket.emit('error', { error: 'unauthorized' });
        return socket.disconnect(true);
      }
      socket.data.authWallet = walletFromToken;
    } catch (e) {
      console.warn(`[WS] handshake auth failed: ${e?.message || e}`);
      socket.emit('error', { error: 'unauthorized' });
      return socket.disconnect(true);
    }

    console.log(`🟢 Cliente conectado: ${socket.id}`);
    try { await APMWs.create({ event: 'connect', wallet: socket.data?.authWallet || null }); } catch {}

    // 2) Rate limiters por socket
    socket.data.rlSignal = makeLimiter({ windowMs: 10_000, max: 60 }); // 60 señales / 10s
    socket.data.rlTyping = makeLimiter({ windowMs: 3_000, max: 15 });   // 15 typing / 3s

    /**
     * ✅ Registrar wallet (debe coincidir con el token) y unir al room
     *    + emitir relay:flush con _id pendientes
     *    + presencia: notificar user_connected a contactos aceptados (sólo primera conexión)
     */
    socket.on('register_wallet', async (pubkey) => {
      try {
        if (!pubkey) return;
        if (socket.data.authWallet !== pubkey) {
          console.warn(`[WS] register_wallet mismatch: token=${socket.data.authWallet} payload=${pubkey}`);
          socket.emit('error', { error: 'unauthorized' });
          return; // anti-spoof
        }

        const userExists = await User.exists({ wallet: pubkey });
        if (!userExists) {
          console.warn(`⚠️ Wallet ${pubkey} no está registrada.`);
          socket.emit('error', { error: 'user_not_found' });
          return;
        }

        socket.join(pubkey);
        socket.data.pubkey = pubkey;

        console.log(`🔗 Wallet ${pubkey} asociada con socket ${socket.id}`);
        socket.emit('registered', { message: '✅ Wallet registrada en WebSocket.' });


        // Presencia (primera conexión)
        const isFirst = trackJoin(pubkey, socket.id);
        updatePresenceTimestamp(pubkey); // Marcar como activo

        if (isFirst) {
          try {
            await broadcastPresenceUpdate(pubkey, { reason: 'user_connected' });
          } catch (e) {
            console.warn(`[WS] presence user_connected error: ${e?.message || e}`);
          }
        }

        // También emitir presence:update en reconexión (no primera)
        if (!isFirst) {
          await broadcastPresenceUpdate(pubkey, { reason: 'reconnected' });
        }

        // Flush IDs pendientes
        try {
          const pending = await RelayMessage.find({ to: pubkey }, { _id: 1 }).lean();
          const ids = pending.map(m => String(m._id));
          if (ids.length) socket.emit('relay:flush', ids);
        } catch (e) {
          console.warn(`[WS] relay:flush fetch error: ${e?.message || e}`);
        }
      } catch (e) {
        console.error(`[WS] register_wallet error ${socket.id}:`, e.message);
        try { await APMWs.create({ event: 'register_wallet', wallet: socket.data?.authWallet || null, ok: false, detail: e?.message }); } catch {}
      }
    });

    /**
     * � Heartbeat para mantener presencia activa
     */
    socket.on('ping', (data) => {
      const wallet = socket.data.authWallet || socket.data.pubkey;
      if (wallet) {
        updatePresenceTimestamp(wallet);
        socket.emit('pong', { 
          timestamp: Date.now(), 
          ttl: PRESENCE_TTL_MS,
          ...data // eco de cualquier data enviada
        });
        // Broadcast de presencia a contactos en cada heartbeat
        broadcastPresenceUpdate(wallet, { reason: 'heartbeat' });
      }
    });


    /**
     * 🔄 Cargar historial de chat
     */
    socket.on('get_chat_history', async ({ pubkey, chatId, signature }) => {
      try {
        if (socket.data.authWallet !== pubkey) return;
        const messages = await loadChatHistory(pubkey, chatId, { wallet: pubkey }, { signature });
        socket.emit('chat_history', { chatId, messages });
      } catch (error) {
        socket.emit('chat_error', { chatId, error: 'No se pudo cargar el historial de chat.' });
      }
    });

    /**
     * 📡 Señalización WebRTC mejorada (rate limited)
     */
    socket.on('signal', async ({ sender, target, signal }) => {
      try {
        // Legacy handler: deprecated (gobernado solo por env)
        const legacyEnabled = String(process.env.RTC_SIGNAL_LEGACY_ENABLED ?? 'false').toLowerCase() === 'true';
        logger.warn('[rtc] legacy signal used', { from: sender, to: target, legacyEnabled, flag: 'rtc.legacySignal' });
        if (!legacyEnabled) {
          return socket.emit('error', { error: 'deprecated', detail: 'Use rtc:offer/answer/candidate' });
        }
        // Rate limit
        if (!socket.data.rlSignal()) {
          return socket.emit('error', { error: 'rate_limited', detail: 'Too many signals' });
        }

        // Anti-spoof y shape mínimo
        if (!sender || socket.data.authWallet !== sender) {
          return socket.emit('error', { error: 'unauthorized' });
        }
        if (!target || !signal) {
          return socket.emit('error', { error: 'invalid_payload' });
        }

        // Validar contacto aceptado MUTUO
        const mutual = await areMutualContacts(sender, target);
        if (!mutual) {
          return socket.emit('error', { error: 'forbidden', detail: 'not_contacts' });
        }

        io.to(target).emit('signal', { sender, signal });

      } catch (e) {
        console.error(`[WS] signal error ${socket.id}:`, e.message);
      }
    });

    /**
     * 🔄 Señalización RTC específica con convId y validaciones de eligibility
     */
    socket.on('rtc:offer', async (body = {}, ack) => {
      try {
        const { convId: rawConvId, from: rawFrom, to, offer, sdp, signalId } = body || {};
        const from = rawFrom || socket.data.authWallet;

        // Log de entrada (sin volcar SDP)
        logger.info('[rtc] offer IN', { from, to, convId: rawConvId, hasSDP: Boolean(offer || sdp), socketId: socket.id });

        if (!signalId) {
          logger.warn('[rtc] signalId:missing', { type: 'offer', from, to, convId: rawConvId });
        }

        if (!socket.data.rlSignal()) {
          logger.warn('[rtc] rate_limited', { type: 'offer', from, to });
          if (typeof ack === 'function') ack({ ok: false, error: 'rate_limited' });
          return socket.emit('rtc:error', { error: 'rate_limited', signalId });
        }

        // Anti-spoof y shape mínimo
        if (!from || socket.data.authWallet !== from) {
          logger.warn('[rtc] invalid_auth', { type: 'offer', from, socketAuth: socket.data.authWallet });
          if (typeof ack === 'function') ack({ ok: false, error: 'unauthorized' });
          return socket.emit('rtc:error', { error: 'unauthorized', signalId });
        }
        if (!to) {
          logger.warn('[rtc] invalid_payload', { type: 'offer', reason: 'missing_to' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }
        const convIdCanon = [from, to].sort().join(':');
        const convId = rawConvId && typeof rawConvId === 'string' ? rawConvId : convIdCanon;
        if (convId !== convIdCanon) {
          logger.warn('[rtc] convId:fix', { type: 'offer', from, to, convId, canon: convIdCanon });
        }
        const desc = offer || sdp; // TODO: deprecate `offer` input; expect only `sdp`
        if (!desc || typeof desc !== 'object' || !desc.sdp || desc.type !== 'offer') {
          logger.warn('[rtc] invalid_payload', { type: 'offer', reason: 'missing_or_invalid_sdp' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }

        if (signalId && isDuplicateSignal(signalId)) {
          if (typeof ack === 'function') ack({ ok: true, type: 'offer', signalId, convId, dedup: true });
          return socket.emit('rtc:ack', { type: 'offer', signalId, convId, dedup: true });
        }

        const mutual = await areMutualContacts(from, to);
        if (!mutual) {
          if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
          return socket.emit('rtc:error', { error: 'forbidden', signalId });
        }

        // Verificar que ambos usuarios sean RTC eligible
        const fromRTCEligible = isRTCEligible(from);
        const targetRTCEligible = isRTCEligible(to);
        
        if (!fromRTCEligible) {
          if (typeof ack === 'function') ack({ ok: false, error: 'sender_not_rtc_eligible' });
          return socket.emit('rtc:error', { error: 'sender_not_rtc_eligible', signalId });
        }
        
        if (!targetRTCEligible) {
          if (typeof ack === 'function') ack({ ok: false, error: 'target_not_rtc_eligible' });
          return socket.emit('rtc:error', { error: 'target_not_rtc_eligible', signalId });
        }

        logger.info('[rtc] forward', { type: 'offer', from, to, convId });
        // Emitir con clave estándar `sdp` únicamente (sin `offer`)
        io.to(to).emit('rtc:offer', { convId, from, sdp: desc, signalId });
        socket.emit('rtc:ack', { type: 'offer', signalId, convId });
        try { await APMWs.create({ event: 'rtc:offer', wallet: from, peer: to, convId, ok: true }); } catch {}
        if (typeof ack === 'function') ack({ ok: true, type: 'offer', signalId, convId });
        markSignalProcessed(signalId);

      } catch (e) {
        logger.error(`[WS] rtc:offer error: ${e?.message || e}`);
        try { await APMWs.create({ event: 'rtc:offer', wallet: socket.data?.authWallet || null, ok: false, detail: e?.message }); } catch {}
        if (typeof ack === 'function') ack({ ok: false, error: 'internal_error' });
        socket.emit('rtc:error', { error: 'internal_error', signalId });
      }
    });

    socket.on('rtc:answer', async (body = {}, ack) => {
      try {
        const { convId: rawConvId, from: rawFrom, to, answer, sdp, signalId } = body || {};
        const from = rawFrom || socket.data.authWallet;

        // Log de entrada (sin volcar SDP)
        logger.info('[rtc] answer IN', { from, to, convId: rawConvId, hasSDP: Boolean(answer || sdp), socketId: socket.id });

        if (!signalId) {
          logger.warn('[rtc] signalId:missing', { type: 'answer', from, to, convId: rawConvId });
        }

        if (!socket.data.rlSignal()) {
          logger.warn('[rtc] rate_limited', { type: 'answer', from, to });
          if (typeof ack === 'function') ack({ ok: false, error: 'rate_limited' });
          return socket.emit('rtc:error', { error: 'rate_limited', signalId });
        }

        if (!from || socket.data.authWallet !== from) {
          logger.warn('[rtc] invalid_auth', { type: 'answer', from, socketAuth: socket.data.authWallet });
          if (typeof ack === 'function') ack({ ok: false, error: 'unauthorized' });
          return socket.emit('rtc:error', { error: 'unauthorized', signalId });
        }
        if (!to) {
          logger.warn('[rtc] invalid_payload', { type: 'answer', reason: 'missing_to' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }
        const convIdCanon = [from, to].sort().join(':');
        const convId = rawConvId && typeof rawConvId === 'string' ? rawConvId : convIdCanon;
        if (convId !== convIdCanon) {
          logger.warn('[rtc] convId:fix', { type: 'answer', from, to, convId, canon: convIdCanon });
        }
        const desc = answer || sdp; // TODO: deprecate `answer` input; expect only `sdp`
        if (!desc || typeof desc !== 'object' || !desc.sdp || desc.type !== 'answer') {
          logger.warn('[rtc] invalid_payload', { type: 'answer', reason: 'missing_or_invalid_sdp' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }

        if (signalId && isDuplicateSignal(signalId)) {
          if (typeof ack === 'function') ack({ ok: true, type: 'answer', signalId, convId, dedup: true });
          return socket.emit('rtc:ack', { type: 'answer', signalId, convId, dedup: true });
        }

        const mutual = await areMutualContacts(from, to);
        if (!mutual) {
          return socket.emit('rtc:error', { error: 'forbidden', signalId });
        }

        // Verificar RTC eligibility para answer (errores diferenciados)
        const fromRTCEligible = isRTCEligible(from);
        const targetRTCEligible = isRTCEligible(to);
        if (!fromRTCEligible) {
          if (typeof ack === 'function') ack({ ok: false, error: 'sender_not_rtc_eligible', fromEligible: fromRTCEligible, toEligible: targetRTCEligible });
          return socket.emit('rtc:error', { error: 'sender_not_rtc_eligible', signalId, fromEligible: fromRTCEligible, toEligible: targetRTCEligible });
        }
        if (!targetRTCEligible) {
          if (typeof ack === 'function') ack({ ok: false, error: 'target_not_rtc_eligible', fromEligible: fromRTCEligible, toEligible: targetRTCEligible });
          return socket.emit('rtc:error', { error: 'target_not_rtc_eligible', signalId, fromEligible: fromRTCEligible, toEligible: targetRTCEligible });
        }

        logger.info('[rtc] forward', { type: 'answer', from, to, convId });
        // Emitir con clave estándar `sdp` únicamente (sin `answer`)
        io.to(to).emit('rtc:answer', { convId, from, sdp: desc, signalId });
        socket.emit('rtc:ack', { type: 'answer', signalId, convId });
        try { await APMWs.create({ event: 'rtc:answer', wallet: from, peer: to, convId, ok: true }); } catch {}
        if (typeof ack === 'function') ack({ ok: true, type: 'answer', signalId, convId });
        markSignalProcessed(signalId);

      } catch (e) {
        logger.error(`[WS] rtc:answer error: ${e?.message || e}`);
        try { await APMWs.create({ event: 'rtc:answer', wallet: socket.data?.authWallet || null, ok: false, detail: e?.message }); } catch {}
        if (typeof ack === 'function') ack({ ok: false, error: 'internal_error' });
        socket.emit('rtc:error', { error: 'internal_error', signalId });
      }
    });

    // Handshake E2EE (pub/pop) — paralelo a rtc:* (sin abrir legacy)
    socket.on('rtc:handshake', async (body = {}, ack) => {
      let capturedSignalId;
      try {
        const { convId: rawConvId, from: rawFrom, to, signal, signalId } = body || {};
        capturedSignalId = signalId;
        const from = rawFrom || socket.data.authWallet;

        // Log de entrada (sin volcar claves)
        const hasSignal = Boolean(signal && typeof signal === 'object');
        logger.info('[rtc] handshake IN', { from, to, convId: rawConvId, hasSignal, socketId: socket.id });

        if (!signalId) {
          logger.warn('[rtc] signalId:missing', { type: 'handshake', from, to, convId: rawConvId });
        }

        // Rate limit global por socket
        if (!socket.data.rlSignal()) {
          logger.warn('[rtc] rate_limited', { type: 'handshake', from, to });
          if (typeof ack === 'function') ack({ ok: false, error: 'rate_limited' });
          return socket.emit('rtc:error', { error: 'rate_limited', signalId });
        }

        // Auth y shape mínimos
        if (!from || socket.data.authWallet !== from) {
          logger.warn('[rtc] invalid_auth', { type: 'handshake', from, socketAuth: socket.data.authWallet });
          if (typeof ack === 'function') ack({ ok: false, error: 'unauthorized' });
          return socket.emit('rtc:error', { error: 'unauthorized', signalId });
        }
        if (!to || from === to) {
          logger.warn('[rtc] invalid_payload', { type: 'handshake', reason: 'missing_or_self_target', from, to });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }

        const convIdCanon = [from, to].sort().join(':');
        const convId = rawConvId && typeof rawConvId === 'string' ? rawConvId : convIdCanon;
        if (convId !== convIdCanon) {
          logger.warn('[rtc] convId:fix', { type: 'handshake', from, to, convId, canon: convIdCanon });
        }

        // Validación de payload específico
        if (!signal || typeof signal !== 'object' || signal.type !== 'handshake') {
          logger.warn('[rtc] invalid_payload', { type: 'handshake', reason: 'missing_or_invalid_signal' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }

        // Guardas de tamaño (defensivas)
        try {
          const approxSize = Buffer.byteLength(JSON.stringify(signal || {}), 'utf8');
          if (approxSize > 2048) {
            logger.warn('[rtc] payload_too_large', { type: 'handshake', approxSize });
            if (typeof ack === 'function') ack({ ok: false, error: 'payload_too_large' });
            return socket.emit('rtc:error', { error: 'payload_too_large', signalId });
          }
        } catch {}

        if (!signal.pub || typeof signal.pub !== 'string') {
          logger.warn('[rtc] invalid_payload', { type: 'handshake', reason: 'missing_pub' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }
        let pubLen = 0;
        try { pubLen = Buffer.from(signal.pub, 'base64').length; } catch { pubLen = 0; }
        if (pubLen !== 65) { // P-256 raw uncompressed (65 bytes) — ajustar si se usa otro esquema
          logger.warn('[rtc] invalid_payload', { type: 'handshake', reason: 'bad_pub_length', pubLen });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }
        if (typeof signal.pop === 'string') {
          let popLen = -1;
          try { popLen = Buffer.from(signal.pop, 'base64').length; } catch { popLen = -1; }
          if (popLen < 0 || popLen > 512) {
            logger.warn('[rtc] invalid_payload', { type: 'handshake', reason: 'bad_pop_size', popLen });
            if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
            return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
          }
        }

        // Dedupe por signalId
        if (signalId && isDuplicateSignal(signalId)) {
          if (typeof ack === 'function') ack({ ok: true, type: 'handshake', signalId, convId, dedup: true });
          return socket.emit('rtc:ack', { type: 'handshake', signalId, convId, dedup: true });
        }

        // Política de contactos confirmados
        const mutual = await areMutualContacts(from, to);
        if (!mutual) {
          if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
          return socket.emit('rtc:error', { error: 'forbidden', signalId });
        }

        // Rate limit adicional por par (sender→target)
        if (!socket.data.rlPairs) socket.data.rlPairs = new Map();
        const pairKey = `${from}-->${to}`;
        let pairLimiter = socket.data.rlPairs.get(pairKey);
        if (!pairLimiter) {
          pairLimiter = makeLimiter({ windowMs: 1000, max: 10 }); // 10/s por par
          socket.data.rlPairs.set(pairKey, pairLimiter);
        }
        if (!pairLimiter()) {
          logger.warn('[rtc] rate_limited_pair', { type: 'handshake', from, to });
          if (typeof ack === 'function') ack({ ok: false, error: 'rate_limited' });
          return socket.emit('rtc:error', { error: 'rate_limited', signalId });
        }

        // Forward sólo al target (sin persistir)
        logger.info('[rtc] forward', { type: 'handshake', from, to, convId });
        io.to(to).emit('rtc:handshake', {
          convId,
          from,
          signal: { type: 'handshake', pub: signal.pub, pop: signal.pop },
          signalId
        });
        socket.emit('rtc:ack', { type: 'handshake', signalId, convId });
        if (typeof ack === 'function') ack({ ok: true, type: 'handshake', signalId, convId });
        markSignalProcessed(signalId);

      } catch (e) {
        logger.error(`[WS] rtc:handshake error: ${e?.message || e}`);
        if (typeof ack === 'function') ack({ ok: false, error: 'internal_error' });
        socket.emit('rtc:error', { error: 'internal_error', signalId: capturedSignalId });
      }
    });

    socket.on('rtc:candidate', async (body = {}, ack) => {
      try {
        const { convId: rawConvId, from: rawFrom, to, candidate, signalId } = body || {};
        const from = rawFrom || socket.data.authWallet;

        // Log de entrada (sin volcar candidate completa)
        const candOk = candidate && (typeof candidate === 'string' || typeof candidate === 'object');
        logger.info('[rtc] candidate IN', { from, to, convId: rawConvId, hasCandidate: Boolean(candOk), socketId: socket.id });

        if (!signalId) {
          logger.warn('[rtc] signalId:missing', { type: 'candidate', from, to, convId: rawConvId });
        }

        if (!socket.data.rlSignal()) {
          logger.warn('[rtc] rate_limited', { type: 'candidate', from, to });
          if (typeof ack === 'function') ack({ ok: false, error: 'rate_limited' });
          return socket.emit('rtc:error', { error: 'rate_limited', signalId });
        }

        if (!from || socket.data.authWallet !== from) {
          logger.warn('[rtc] invalid_auth', { type: 'candidate', from, socketAuth: socket.data.authWallet });
          if (typeof ack === 'function') ack({ ok: false, error: 'unauthorized' });
          return socket.emit('rtc:error', { error: 'unauthorized', signalId });
        }
        if (!to) {
          logger.warn('[rtc] invalid_payload', { type: 'candidate', reason: 'missing_to' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }
        const convIdCanon = [from, to].sort().join(':');
        const convId = rawConvId && typeof rawConvId === 'string' ? rawConvId : convIdCanon;
        if (convId !== convIdCanon) {
          logger.warn('[rtc] convId:fix', { type: 'candidate', from, to, convId, canon: convIdCanon });
        }
        if (!candidate) {
          logger.warn('[rtc] invalid_payload', { type: 'candidate', reason: 'missing_candidate' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }

        if (signalId && isDuplicateSignal(signalId)) {
          return socket.emit('rtc:ack', { type: 'candidate', signalId, convId, dedup: true });
        }

        const mutual = await areMutualContacts(from, to);
        if (!mutual) {
          if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
          return socket.emit('rtc:error', { error: 'forbidden', signalId });
        }

        // Normalizar candidate si viene como string plano
        let candObj = candidate;
        if (typeof candidate === 'string') {
          candObj = { candidate };
        }
        // Validación defensiva: candidate string y al menos una de sdpMid/sdpMLineIndex presente
        const hasCandStr = typeof candObj?.candidate === 'string' && candObj.candidate.length > 0;
        const hasMidOrIndex = (candObj?.sdpMid != null) || (candObj?.sdpMLineIndex != null);
        if (!hasCandStr || !hasMidOrIndex) {
          logger.warn('[rtc] invalid_payload', { type: 'candidate', reason: 'invalid_candidate_shape' });
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
          return socket.emit('rtc:error', { error: 'invalid_payload', signalId });
        }
        // Para candidates no validamos eligibility (pueden llegar después del offer/answer)
        logger.info('[rtc] forward', { type: 'candidate', from, to, convId });
        try { await APMWs.create({ event: 'rtc:candidate', wallet: from, peer: to, convId, ok: true }); } catch {}
        io.to(to).emit('rtc:candidate', { convId, from, candidate: candObj, signalId });
        // Opcional: ACK solo para candidates importantes
        if (signalId) {
          socket.emit('rtc:ack', { type: 'candidate', signalId, convId });
          markSignalProcessed(signalId);
        }
        if (typeof ack === 'function') ack({ ok: true, type: 'candidate', signalId, convId });

      } catch (e) {
        logger.error(`[WS] rtc:candidate error: ${e?.message || e}`);
        try { await APMWs.create({ event: 'rtc:candidate', wallet: socket.data?.authWallet || null, ok: false, detail: e?.message }); } catch {}
        if (typeof ack === 'function') ack({ ok: false, error: 'internal_error' });
      }
    });

    /**
     * ⌨️ Indicador de "typing" (anti-eco): sólo al destinatario, nunca al emisor
     */
    socket.on('typing', async (payload = {}) => {
      try {
        if (!socket.data.rlTyping()) {
          return socket.emit('error', { error: 'rate_limited', detail: 'Too many typing' });
        }

        const sender = payload.sender || payload.from;
        const target = payload.target || payload.to;
        const convId = payload.convId || null;
        const isTyping = Boolean(payload.isTyping);

        if (!sender || socket.data.authWallet !== sender) {
          return socket.emit('error', { error: 'unauthorized' });
        }
        if (!target) {
          return socket.emit('error', { error: 'invalid_payload' });
        }

        const mutual = await areMutualContacts(sender, target);
        if (!mutual) {
          return socket.emit('error', { error: 'forbidden', detail: 'not_contacts' });
        }

        io.to(target).emit('typing', { from: sender, to: target, convId, isTyping });
      } catch (e) {
        console.error(`[WS] typing error ${socket.id}:`, e.message);
        try { await APMWs.create({ event: 'typing', wallet: socket.data?.authWallet || null, ok: false, detail: e?.message }); } catch {}
      }
    });

    /**
     * 🚪 Desconexión
     */
    socket.on('disconnect', async () => {
      const disconnectedUser = socket.data.pubkey || socket.data.authWallet;
      if (!disconnectedUser) return;

      console.log(`❌ Wallet ${disconnectedUser} desconectada.`);
      try { await APMWs.create({ event: 'disconnect', wallet: disconnectedUser }); } catch {}

      // ÚLTIMA conexión: emite presencia offline
      const lastHb = getLastHeartbeat(disconnectedUser) || Date.now();
      const isLast = trackLeave(disconnectedUser, socket.id);
      if (isLast) {
        // Limpiar timestamp de presencia
        presenceTimestamps.delete(disconnectedUser);
        
        try {
          const contacts = await getAcceptedContacts(disconnectedUser);
          for (const w of contacts) {
            if (PRESENCE_LEGACY_EMIT) {
              io.to(w).emit('user_disconnected', { pubkey: disconnectedUser });
              io.to(w).emit('presence', { pubkey: disconnectedUser, online: false }); // compat legacy
            } else {
              logger?.info?.('[presence] legacy suppressed', { pubkey: disconnectedUser, reason: 'disconnect' });
            }
            io.to(w).emit('presence:update', { 
              pubkey: disconnectedUser, 
              online: false, 
              rtcEligible: false,
              lastHeartbeat: lastHb,
              reason: 'disconnected', 
              timestamp: Date.now() 
            });
          }
        } catch (e) {
          console.error(`[WS] notify disconnect error:`, e.message);
        }
      }
    });

  });

  return { server, io };
}

export { io };

// Exportar funciones útiles para otros módulos
export { isWalletOnlineWithTTL, updatePresenceTimestamp, isRTCEligible };
