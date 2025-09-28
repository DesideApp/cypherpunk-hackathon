// src/features/messaging/store/messagesStore.js
// Store mínimo (sin libs) para gestionar mensajes por conversación,
// presencia/typing y errores. API: subscribe, getState, actions.*

import { canonicalConvId } from "../domain/id.js";
import { STORAGE_NS } from "@shared/config/env.js";

// ✅ ConvId determinista y ÚNICO: "A:B"
export { canonicalConvId as convId };

const LS_PREFIX = `${STORAGE_NS}:msgs_v2:`;

// --- LS helpers (cotas simples)
function load(conv) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + conv);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function save(conv, msgs) {
  try {
    localStorage.setItem(LS_PREFIX + conv, JSON.stringify(msgs.slice(-500)));
  } catch { /* quota – ignore */ }
}

// --- Estado
const state = new Map();          // convId -> Array<msg>
const subs = new Map();           // convId -> Set<fn(list)>
const globalSubs = new Set();     // Set<fn(fullState)>
let lastError = null;

// --- Notificación
function emitConv(conv, msgs) {
  const set = subs.get(conv);
  if (!set) return;
  for (const fn of set) { try { fn(msgs); } catch {} }
}
function notifyAll() {
  const snapshot = getState();
  for (const cb of globalSubs) { try { cb(snapshot); } catch {} }
}

// --- Lectura
export function get(conv) {
  if (!state.has(conv)) state.set(conv, load(conv));
  return state.get(conv);
}
export function getState() {
  const byConversation = Object.fromEntries(state.entries());
  return {
    byConversation,
    lastError,
  };
}

// --- Escritura base
function set(conv, list) {
  state.set(conv, list);
  save(conv, list);
  emitConv(conv, list);
}

// --- Suscripción
/**
 * subscribe(convOrCb, cb?)
 *  - subscribe(fn)                   → global
 *  - subscribe(convId, fn(list))     → por conversación
 */
export function subscribe(a, b) {
  if (typeof a === "function") {
    const cb = a;
    globalSubs.add(cb);
    try { cb(getState()); } catch {}
    return () => globalSubs.delete(cb);
  }
  const conv = a; const cb = b;
  if (!subs.has(conv)) subs.set(conv, new Set());
  subs.get(conv).add(cb);
  try { cb(get(conv)); } catch {}
  return () => subs.get(conv)?.delete(cb);
}

// --- Utilidades de mensajes
export function nextClientMsgId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function byCreatedAtAsc(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); }

function add(conv, msg) {
  const list = get(conv).slice();
  const idx = list.findIndex(m =>
    (msg.clientMsgId && m.clientMsgId === msg.clientMsgId) ||
    (msg.clientId    && m.clientId    === msg.clientId)
  );
  if (idx >= 0) list[idx] = { ...list[idx], ...msg };
  else list.push({ ...msg, createdAt: msg.createdAt || Date.now() });
  set(conv, list.sort(byCreatedAtAsc));
}

function upsertByClient(conv, patch) {
  const list = get(conv).slice();
  const id = patch.clientMsgId || patch.clientId;
  const idx = list.findIndex(m => (m.clientMsgId === id || m.clientId === id));
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
  } else {
    // Inserción si no existía (evita perder el "pending")
    list.push({
      ...patch,
      clientId: id,
      clientMsgId: id,
      createdAt: patch.createdAt || Date.now(),
    });
  }
  set(conv, list.sort(byCreatedAtAsc));
}

// --- Normalización de entrantes (RTC/Relay)
function normalizeIncoming(raw) {
  const base = {
    id: raw?.id || raw?.serverId || undefined,
    clientId: raw?.clientId || raw?.clientMsgId || undefined,
    createdAt: raw?.createdAt || Date.now(),
    sender: raw?.sender || "other",
    status: raw?.status || "sent",
    via: raw?.via || null,
  };

  const payload = raw?.payload ? raw.payload : raw;
  const from = raw?.from ?? payload?.from ?? raw?.meta?.from ?? null;
  const to = raw?.to ?? payload?.to ?? raw?.meta?.to ?? null;
  const convId = raw?.convId ?? payload?.convId ?? raw?.meta?.convId ?? null;
  const aad = raw?.aad ?? payload?.aad ?? null;
  const mime = raw?.mime ?? payload?.mime ?? raw?.meta?.mime ?? null;
  const messageKind = raw?.messageType || payload?.kind || raw?.meta?.kind || null;

  const envelopeFromPayload = payload?.envelope && payload.envelope.iv && payload.envelope.cipher
    ? { iv: payload.envelope.iv, cipher: payload.envelope.cipher, aad: payload.envelope.aad || payload.envelope.aadB64 || null }
    : null;

  const envelopeFromLegacy = (!envelopeFromPayload && raw?.box)
    ? { iv: raw?.iv || payload?.iv || null, cipher: raw.box, aad }
    : null;

  // Texto
  if (payload?.kind === "text" || typeof payload?.text === "string") {
    return {
      ...base,
      kind: "text",
      text: payload.text ?? String(payload?.body ?? ""),
      from,
      to,
      convId,
      aad,
      envelope: envelopeFromPayload || envelopeFromLegacy || null,
      via: raw?.via || payload?.via || raw?.transport || raw?.meta?.via || base.via || null,
    };
  }

  // Media (binarios)
  // Envelopes cifrados (se propagan para descifrar después)
  if (payload?.envelope && payload?.kind === "text") {
    const env = payload.envelope && typeof payload.envelope === 'object' ? payload.envelope : {};
    // Mantener aad si venía fuera para no romper descifrado
    return {
      ...base,
      kind: "text",
      envelope: {
        ...env,
        ...(env?.aad || env?.aadB64 ? {} : (payload?.aad || payload?.aadB64 ? { aad: payload.aad, aadB64: payload.aadB64 } : {})),
      },
      from,
      to,
      convId,
      aad,
    };
  }
  // Fallback
  return {
    ...base,
    kind: messageKind || payload?.kind || "text",
    text: typeof payload === 'string' ? payload : String(payload ?? ""),
    mime,
    from,
    to,
    convId,
    aad,
    envelope: envelopeFromPayload || envelopeFromLegacy || null,
    via: raw?.via || payload?.via || raw?.transport || raw?.meta?.via || base.via || null,
  };
}

// --- API de acciones
export const actions = {
  hydrate(conv, list) {
    set(conv, Array.isArray(list) ? list.slice().sort(byCreatedAtAsc) : []);
    notifyAll();
  },

  upsertBatch(conv, list) {
    if (!Array.isArray(list) || !conv) return;
    const cur = get(conv).slice();
    const byServer = new Map(cur.map(m => [m.id || m.serverId || null, m]));
    for (const m of list) {
      const sid = m.id || m.serverId || null;
      if (sid && byServer.has(sid)) {
        const idx = cur.findIndex(x => (x.id || x.serverId) === sid);
        if (idx >= 0) cur[idx] = { ...cur[idx], ...m };
      } else {
        cur.push({ ...m, createdAt: m.createdAt || Date.now() });
      }
    }
    set(conv, cur.sort(byCreatedAtAsc)); notifyAll();
  },

  upsertMessage(conv, payload) {
    if (!conv || !payload) return;
    const cid = payload.clientId || payload.clientMsgId;
    if (cid) { upsertByClient(conv, { ...payload, clientId: cid, clientMsgId: cid }); notifyAll(); return; }
    const cur = get(conv).slice();
    const idx = cur.findIndex(m => (m.id === payload.id) || (m.serverId === payload.id));
    if (idx >= 0) { cur[idx] = { ...cur[idx], ...payload }; set(conv, cur); }
    else { cur.push({ ...payload, createdAt: payload.createdAt || Date.now() }); set(conv, cur); }
    notifyAll();
  },

  addIncoming(conv, rawMsg) {
    const msg = normalizeIncoming(rawMsg);
    add(conv, msg);
    notifyAll();
  },

  markSent(conv, clientId) {
    upsertByClient(conv, { clientMsgId: clientId, clientId, status: "sent" });
    notifyAll();
  },

  markDelivered(conv, clientId, deliveredAt = Date.now()) {
    upsertByClient(conv, { clientMsgId: clientId, clientId, status: "delivered", deliveredAt });
    notifyAll();
  },

  markRead(conv, clientId, readAt = Date.now()) {
    upsertByClient(conv, { clientMsgId: clientId, clientId, status: "read", readAt });
    notifyAll();
  },

  markFailed(conv, clientId, reason) {
    upsertByClient(conv, { clientMsgId: clientId, clientId, status: "failed", reason });
    notifyAll();
  },

  // Estados auxiliares
  setError(err) { lastError = err; notifyAll(); },
};
