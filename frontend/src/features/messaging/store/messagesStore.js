// src/features/messaging/store/messagesStore.js
// Store mínimo (sin libs) para gestionar mensajes por conversación,
// presencia/typing y errores. API: subscribe, getState, actions.*

import { canonicalConvId, canonicalWallet } from "../domain/id.js";
// import { STORAGE_NS } from "@shared/config/env.js";

// ✅ ConvId determinista y ÚNICO: "A:B"
export { canonicalConvId as convId };

const LS_PREFIX = "deside_msgs_v1:";

const sanitizedConversations = new Set(); // convId::selfWallet

function canonicalOrNull(value) {
  const trimmed = canonicalWallet(value);
  return trimmed ? trimmed : null;
}

function resolveSenderTag(message, normalizedSelf) {
  const current = message?.sender;
  if (current === "me" || current === "other") return current;
  if (!normalizedSelf) return null;

  const senderWallet = current ? canonicalOrNull(current) : null;
  if (senderWallet && senderWallet === normalizedSelf) return "me";

  const fromWallet = canonicalOrNull(message?.from || message?.author);
  if (fromWallet) return fromWallet === normalizedSelf ? "me" : "other";

  const toWallet = canonicalOrNull(message?.to || message?.recipient);
  if (toWallet && toWallet === normalizedSelf) return "other";

  return senderWallet ? "other" : null;
}

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
const presence = new Map();       // wallet -> boolean
const typing = new Map();         // convId -> boolean (remoto)
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
    presence: Object.fromEntries(presence.entries()),
    typing: Object.fromEntries(typing.entries()),
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

function senderTag(message, normalizedSelf) {
  if (!message) return null;
  if (message.sender === "me" || message.sender === "other") return message.sender;
  const resolved = resolveSenderTag(message, normalizedSelf);
  if (resolved) return resolved;
  if (message.direction === "sent") return "me";
  if (message.direction === "received") return "other";
  return null;
}

function findMergeIndex(list, incoming, normalizedSelf) {
  const agreementId = incoming?.meta?.agreementId || incoming?.agreement?.id || null;
  if (!agreementId) return -1;
  const incomingTag = senderTag(incoming, normalizedSelf);
  return list.findIndex((m, idx) => {
    const currentId = m?.meta?.agreementId || m?.agreement?.id || null;
    if (!currentId || currentId !== agreementId) return false;
    const existingTag = senderTag(m, normalizedSelf);
    console.debug('[messagesStore] compare', {
      idx,
      agreementId: currentId,
      existingTag,
      incomingTag,
      existingId: m.id || m.serverId,
      incomingId: incoming.id || incoming.serverId,
    });
    if (incomingTag && existingTag && incomingTag !== existingTag) return false;
    if (incomingTag && incomingTag === existingTag) return true;
    if (!incomingTag && !existingTag) return true;
    return true;
  });
}

function mergeMessage(existing, patch, normalizedSelf) {
  const merged = { ...existing, ...patch };
  const incomingTag = senderTag(patch, normalizedSelf);
  const existingTag = senderTag(existing, normalizedSelf);
  if (incomingTag !== null) {
    merged.sender = incomingTag;
  } else if (existingTag !== null) {
    merged.sender = existingTag;
  }
  const resolved = resolveSenderTag(merged, normalizedSelf);
  if (resolved) merged.sender = resolved;
  if (existing?.meta && patch?.meta) {
    merged.meta = { ...existing.meta, ...patch.meta };
  }
  return merged;
}

function upsertByClient(conv, patch, selfWallet) {
  const list = get(conv).slice();
  const id = patch.clientMsgId || patch.clientId;
  const idx = list.findIndex(m => (m.clientMsgId === id || m.clientId === id));
  const normalizedSelf = canonicalOrNull(selfWallet);
  if (idx >= 0) {
    const merged = { ...list[idx], ...patch };
    if (list[idx]?.sender === "me" && merged.sender !== "me") {
      merged.sender = "me";
    }
    const resolved = resolveSenderTag(merged, normalizedSelf);
    if (resolved) merged.sender = resolved;
    list[idx] = merged;
  } else {
    // Inserción si no existía (evita perder el "pending")
    const next = {
      ...patch,
      clientId: id,
      clientMsgId: id,
      createdAt: patch.createdAt || Date.now(),
    };
    const resolved = resolveSenderTag(next, normalizedSelf);
    if (resolved) next.sender = resolved;
    list.push(next);
  }
  set(conv, list.sort(byCreatedAtAsc));
}

// --- Normalización de entrantes (RTC/Relay)
function normalizeIncoming(raw, selfWallet) {
  const base = {
    id: raw?.id || raw?.serverId || undefined,
    clientId: raw?.clientId || raw?.clientMsgId || undefined,
    createdAt: raw?.createdAt || Date.now(),
    sender: raw?.sender || raw?.payload?.sender || raw?.meta?.sender || null,
    status: raw?.status || "sent",
    via: raw?.via || null,
    meta: raw?.meta && typeof raw.meta === "object" ? { ...raw.meta } : null,
    agreementId: raw?.meta?.agreementId || raw?.agreementId || raw?.payload?.agreementId || null,
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

  const normalizedSelf = canonicalOrNull(selfWallet);
  const normalizedFrom = canonicalOrNull(from);
  let senderTag = resolveSenderTag({ sender: base.sender, from, to }, normalizedSelf);
  if (!senderTag) {
    if (base.sender === "me" || base.sender === "other") senderTag = base.sender;
    else if (normalizedSelf && normalizedFrom) senderTag = normalizedFrom === normalizedSelf ? "me" : "other";
    else if (base.sender) senderTag = "other";
    else senderTag = "other";
  }
  base.sender = senderTag;

  // Texto
  if (payload?.kind === "text" || typeof payload?.text === "string") {
    return {
      ...base,
      sender: senderTag,
      direction: senderTag === "me" ? "sent" : "received",
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
    direction: senderTag === "me" ? "sent" : "received",
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

  upsertBatch(conv, list, selfWallet) {
    if (!Array.isArray(list) || !conv) return;
  const cur = get(conv).slice();
  const byServer = new Map(cur.map(m => [m.id || m.serverId || null, m]));
  const normalizedSelf = canonicalOrNull(selfWallet);
  for (const m of list) {
    const sid = m.id || m.serverId || null;
    let idx = sid ? cur.findIndex(x => (x.id || x.serverId) === sid) : -1;
    if (idx < 0) {
      idx = findMergeIndex(cur, m, normalizedSelf);
    }
    if (idx < 0 && m?.meta?.agreementId) {
      console.debug('[messagesStore] upsertBatch insert agreement message', {
        agreementId: m.meta.agreementId,
        sender: m.sender,
        id: m.id,
        serverId: m.serverId,
        conv,
      });
    }
    if (idx >= 0) {
      cur[idx] = mergeMessage(cur[idx], m, normalizedSelf);
    } else {
      const next = { ...m, createdAt: m.createdAt || Date.now() };
      const resolved = resolveSenderTag(next, normalizedSelf);
        if (resolved) next.sender = resolved;
        cur.push(next);
      }
    }
    set(conv, cur.sort(byCreatedAtAsc));
    notifyAll();
  },

  upsertMessage(conv, payload, selfWallet) {
    if (!conv || !payload) return;
    const normalizedSelf = canonicalOrNull(selfWallet);
    const cid = payload.clientId || payload.clientMsgId;
    if (cid) {
      upsertByClient(conv, { ...payload, clientId: cid, clientMsgId: cid }, selfWallet);
      notifyAll();
      return;
    }
    const list = get(conv).slice();
    let idx = list.findIndex(m => (m.id === payload.id) || (m.serverId === payload.id));
    if (idx < 0) {
      idx = findMergeIndex(list, payload, normalizedSelf);
    }
    if (idx >= 0) {
      list[idx] = mergeMessage(list[idx], payload, normalizedSelf);
    } else {
      const next = {
        ...payload,
        createdAt: payload.createdAt || Date.now(),
      };
      const resolved = resolveSenderTag(next, normalizedSelf);
      if (resolved) next.sender = resolved;
      list.push(next);
    }
    set(conv, list.sort(byCreatedAtAsc));
    notifyAll();
  },

  addIncoming(conv, rawMsg, selfWallet) {
    const msg = normalizeIncoming(rawMsg, selfWallet);
    add(conv, msg);
    notifyAll();
  },

  sanitizeConversation(conv, selfWallet) {
    const normalizedSelf = canonicalOrNull(selfWallet);
    if (!conv || !normalizedSelf) return;
    const key = `${conv}::${normalizedSelf}`;
    if (sanitizedConversations.has(key)) return;
    const list = get(conv);
    if (!Array.isArray(list) || list.length === 0) {
      sanitizedConversations.add(key);
      return;
    }
    let changed = false;
    const updated = list.map((msg) => {
      const resolved = resolveSenderTag(msg, normalizedSelf);
      if (resolved && resolved !== msg?.sender) {
        changed = true;
        return { ...msg, sender: resolved };
      }
      return msg;
    });
    if (changed) set(conv, updated);
    sanitizedConversations.add(key);
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

  setPresence(wallet, online) {
    if (!wallet) return;
    const bool = !!online;
    if (bool) {
      const prev = presence.get(wallet);
      if (prev === bool) return;
      presence.set(wallet, true);
    } else if (presence.has(wallet)) {
      presence.delete(wallet);
    } else {
      return;
    }
    notifyAll();
  },

  setTyping(conv, flag) {
    if (!conv) return;
    const bool = !!flag;
    if (bool) {
      const prev = typing.get(conv);
      if (prev === bool) return;
      typing.set(conv, true);
    } else if (typing.has(conv)) {
      typing.delete(conv);
    } else {
      return;
    }
    notifyAll();
  },
};
