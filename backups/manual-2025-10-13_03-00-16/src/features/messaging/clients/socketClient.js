// src/features/messaging/clients/socketClient.js
import { getSocketInstance } from "@shared/socket";
import { canonicalConvId as _convIdOf } from "@features/messaging/domain/id.js";
import { emitRtcSignal as _emitRtcSignal } from "./signalHelpers.js";
import { v4 as uuid } from "uuid";
import ENV from "@shared/config/env.js";
import { rtcDebug } from "@shared/utils/rtcDebug.js";
import { createDebugLogger } from "@shared/utils/debug.js";

const presenceMap = new Map();
const presenceInfo = new Map();
let heartbeatTimer = null;
let isHeartbeatRunning = false;
const rtcErrors = new Map();
const DEBUG = createDebugLogger("socketClient", { envKey: "VITE_DEBUG_SOCKET_LOGS" });

// 👇 suave: LRU mínimo para deduplicar señales por signalId (TTL 60s)
const seenSignals = new Map(); // signalId -> ts
const SEEN_TTL = 60_000;
const SEEN_MAX = 2000;
function seenOnce(id) {
  if (!id) return false;
  const now = Date.now();
  const prev = seenSignals.get(id);
  if (prev && now - prev < SEEN_TTL) return true;
  seenSignals.set(id, now);
  // poda suave
  if (seenSignals.size > SEEN_MAX) {
    const cutoff = now - SEEN_TTL;
    for (const [k, t] of seenSignals) {
      if (t < cutoff) seenSignals.delete(k);
      if (seenSignals.size <= SEEN_MAX) break;
    }
  }
  return false;
}

function extractPeerId(p) {
  try {
    return (
      p?.from || p?.sender || p?.wallet || p?.peer || p?.pubkey || p?.id || null
    );
  } catch {
    return null;
  }
}
function touchPeer(peer) {
  if (peer) presenceMap.set(peer, Date.now());
}

function createEventBus() {
  const listeners = new Map();
  return {
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => this.off(type, fn);
    },
    off(type, fn) {
      const set = listeners.get(type);
      if (set) set.delete(fn);
    },
    emit(type, payload) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of set) { try { fn(payload); } catch (_) {} }
    },
    _listeners: listeners,
  };
}

let singleton = null;
let wiredTo = null;
let autoWireTimer = null;

function wirePresence(socket, busEmit) {
  const onPresenceUpdate = (p) => {
    const wallet = p?.userId || p?.wallet || p?.pubkey || p?.id;
    if (!wallet) return;
    const online = (typeof p?.online === "boolean") ? p.online : !!p?.isOnline;
    const now = Date.now();
    if (online) presenceMap.set(wallet, now);
    else presenceMap.delete(wallet);
    presenceInfo.set(wallet, { lastSeen: p?.lastSeen || now, rtcEligible: !!p?.rtcEligible });
    busEmit("presence", { pubkey: wallet, online, raw: p });
  };
  socket.on("presence:update", onPresenceUpdate);
}

function ensureWired(bus) {
  const socket = getSocketInstance();
  if (!socket) return;
  if (wiredTo === socket) return;

  wiredTo = socket;
  try { if (autoWireTimer) { clearInterval(autoWireTimer); autoWireTimer = null; } } catch {}

  socket.on("connect",    () => bus.emit("open"));
  socket.on("disconnect", () => { presenceMap.clear(); bus.emit("close"); });

  // LEGACY passthrough (no dedupe posible si no trae signalId)
  socket.on("signal", (p) => {
    try { rtcDebug('signal:in', { shape: p?.signal ? 'envelope' : 'flat', type: p?.signal?.type || p?.type }); } catch {}
    bus.emit("signal", p);
  });

  // --- Nuevos eventos rtc:* con dedupe suave ---
  socket.on("rtc:offer", (p) => {
    if (seenOnce(p?.signalId)) return;                 // 👈 corta duplicados
    touchPeer(p?.from || p?.sender);
    const convId = p?.convId || (p?.from && p?.to ? _convIdOf(p.from, p.to) : undefined);
    rtcDebug('offer:in', { from: p?.from || p?.sender, to: p?.to, convId });
    const sdp = p?.sdp || p?.offer;
    bus.emit("signal", { type: "offer", sdp, from: p?.from || p?.sender, to: p?.to, convId, signalId: p?.signalId });
  });

  socket.on("rtc:answer", (p) => {
    if (seenOnce(p?.signalId)) return;
    touchPeer(p?.from || p?.sender);
    const convId = p?.convId || (p?.from && p?.to ? _convIdOf(p.from, p.to) : undefined);
    rtcDebug('answer:in', { from: p?.from || p?.sender, to: p?.to, convId });
    const sdp = p?.sdp || p?.answer;
    bus.emit("signal", { type: "answer", sdp, from: p?.from || p?.sender, to: p?.to, convId, signalId: p?.signalId });
  });

  socket.on("rtc:candidate", (p) => {
    // Algunos servers no setean signalId en candidates; dedupe solo si existe
    if (seenOnce(p?.signalId)) return;
    touchPeer(p?.from || p?.sender);
    const cand = p?.candidate || p?.ice || p?.payload;
    if (!cand) return;
    const convId = p?.convId || (p?.from && p?.to ? _convIdOf(p.from, p.to) : undefined);
    rtcDebug('candidate:in', { from: p?.from || p?.sender, to: p?.to, convId });
    bus.emit("signal", { type: "ice-candidate", candidate: cand, from: p?.from || p?.sender, to: p?.to, convId, signalId: p?.signalId });
  });

  socket.on("rtc:handshake", (p) => {
    if (seenOnce(p?.signalId)) return;
    touchPeer(p?.from || p?.sender);
    const convId = p?.convId || (p?.from && p?.to ? _convIdOf(p.from, p.to) : undefined);
    rtcDebug('handshake:in', { from: p?.from || p?.sender, to: p?.to || p?.target, convId });
    const flat = (p?.signal && p?.signal?.type === 'handshake')
      ? { ...p.signal, from: p.from || p.sender, to: p.target || p.to, convId, signalId: p.signalId }
      : { type: 'handshake', pub: p?.pub, pop: p?.pop, from: p?.from || p?.sender, to: p?.to, convId, signalId: p?.signalId };
    bus.emit("signal", flat);
  });

  socket.on("rtc:ack",   (ack) => { rtcDebug('ack', ack); bus.emit("rtc:ack", ack); });
  socket.on("rtc:error", (e) => {
    try {
      const from = e?.from || e?.sender || null;
      const to = e?.to || null;
      const conv = e?.convId || ((from && to) ? _convIdOf(from, to) : null);
      const reason = e?.reason || e?.code || null;
      if (conv && reason) { rtcErrors.set(conv, { reason, ts: Date.now(), raw: e }); }
    } catch {}
    rtcDebug('error', e);
    bus.emit("rtc:error", e);
  });

  socket.on("relay:flush", (payload) => bus.emit("relay:flush", payload));
  socket.on("typing",    (payload) => { touchPeer(extractPeerId(payload)); bus.emit("typing", payload); });
  socket.on("delivered", (payload) => bus.emit("delivered", payload));

  socket.on("pong", (payload) => {
    const peer = extractPeerId(payload);
    if (peer) touchPeer(peer);
  });

  wirePresence(socket, bus.emit.bind(bus));
}

// --- API pública ---
export function convIdOf(a, b) { return _convIdOf(a, b); }
export function emitSignal(socket, type, { from, to, convId, sdp, candidate }) {
  return _emitRtcSignal(socket, type, { from, to, convId, sdp, candidate });
}

export function getSocketClient() {
  if (singleton) return singleton;

  const bus = createEventBus();
  ensureWired(bus);
  if (!wiredTo && !autoWireTimer) {
    autoWireTimer = setInterval(() => {
      try { ensureWired(bus); if (wiredTo) { clearInterval(autoWireTimer); autoWireTimer = null; } } catch {}
    }, 50);
  }

  function safeSend(type, payload) {
    ensureWired(bus);
    try {
      const s = getSocketInstance();
      if (!s || !s.connected) throw new Error("WS_NOT_OPEN");
      if (type === 'signal') {
        const signal = payload?.signal || payload;
        const to = payload?.target || payload?.to;
        const from = payload?.from || payload?.sender || signal?.from;
        const convId = payload?.convId || signal?.convId || (from && to ? _convIdOf(from, to) : undefined);
        // Handshake E2EE
        if (signal?.type === 'handshake' || payload?.type === 'handshake') {
          const env = (payload?.signal?.type === 'handshake')
            ? { ...payload, from, to, convId, signalId: payload?.signalId || signal?.signalId || uuid() }
            : {
                from, sender: from, to, target: to, convId,
                signalId: payload?.signalId || signal?.signalId || uuid(),
                signal: { type: 'handshake', pub: payload?.pub || signal?.pub, pop: payload?.pop || signal?.pop },
              };
          s.emit('rtc:handshake', env);
          return true;
        }
        if (signal?.type && (signal?.sdp || signal?.candidate)) {
          // añade signalId si no viene (suave)
          if (!signal.signalId) signal.signalId = uuid();
          return emitSignal(s, signal.type, { from, to, convId, sdp: signal.sdp, candidate: signal.candidate, signalId: signal.signalId });
        }
        if (!signal?.type && signal?.candidate) {
          return emitSignal(s, 'candidate', { from, to, convId, candidate: signal.candidate, signalId: uuid() });
        }
        return false;
      }
      s.emit(type, payload);
      return true;
    } catch {
      return false;
    }
  }

  function isConnected() {
    ensureWired(bus);
    const s = getSocketInstance();
    return !!s && !!s.connected;
  }

  function isPeerOnline(pubkey, maxAgeMs = (ENV?.MESSAGING?.PRESENCE_TTL_MS ?? 45_000)) {
    const ts = presenceMap.get(pubkey);
    return !!ts && Date.now() - ts < maxAgeMs;
  }

  function getPresence(pubkey, maxAgeMs = (ENV?.MESSAGING?.PRESENCE_TTL_MS ?? 45_000)) {
    const now = Date.now();
    const ts = presenceMap.get(pubkey) || 0;
    const online = !!ts && (now - ts) < maxAgeMs;
    const extra = presenceInfo.get(pubkey) || {};
    const ttlRemaining = online ? Math.max(0, maxAgeMs - (now - ts)) : 0;
    return { online, ttlRemaining, lastSeen: extra.lastSeen || ts || null, rtcEligible: !!extra.rtcEligible };
  }

  function startHeartbeat() {
    if (isHeartbeatRunning) return;
    isHeartbeatRunning = true;

    const intervalMs = ENV?.MESSAGING?.HEARTBEAT_INTERVAL_MS ?? 35_000;
    const sendPing = () => {
      const payload = { ts: Date.now(), from: 'client' };
      if (safeSend('ping', payload)) {
        DEBUG('ping sent', payload);
      }
    };
    sendPing();
    heartbeatTimer = setInterval(sendPing, intervalMs);
    DEBUG('heartbeat started', { intervalMs });
  }

  function getLastRtcError(convId, ttlMs = 5000) {
    if (!convId) return null;
    const entry = rtcErrors.get(convId);
    if (!entry) return null;
    if (Date.now() - entry.ts > ttlMs) { rtcErrors.delete(convId); return null; }
    return entry;
  }

  function clearRtcError(convId) {
    if (convId) rtcErrors.delete(convId);
  }

  function stopHeartbeat() {
    if (!isHeartbeatRunning) return;
    isHeartbeatRunning = false;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    DEBUG('heartbeat stopped');
  }

  singleton = {
    on: (t, fn) => { ensureWired(bus); return bus.on(t, fn); },
    off: (t, fn) => { ensureWired(bus); return bus.off(t, fn); },
    subscribe: (t, fn) => { ensureWired(bus); return bus.on(t, fn); },
    unsubscribe: (t, fn) => { ensureWired(bus); return bus.off(t, fn); },
    send: (type, payload) => safeSend(type, payload),
    disconnect: () => { try { getSocketInstance()?.disconnect?.(); } catch {} },
    isConnected,
    isPeerOnline,
    getPresence,
    getLastRtcError,
    clearRtcError,
    startHeartbeat,
    stopHeartbeat,
    get status() { return isConnected() ? "open" : "closed"; },
  };

  return singleton;
}

export default getSocketClient();
