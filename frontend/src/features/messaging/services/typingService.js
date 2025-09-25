// src/features/messaging/services/typingService.js
// Servicio central de "typing" (entrada/salida) con TTL de 4000ms y bus por convId.
// - Emite/escucha por socket "typing" (vía wrapper socketClient).
// - API: attachTypingSocketListener(), onTyping(convId, cb), sendTyping({from,to,isTyping})

import socketClient from "../clients/socketClient.js";
import { convId as canonicalConvId } from "@features/messaging/store/messagesStore.js";

const listenersByConv = new Map(); // convId -> Set(cb)
const lastSeen = new Map();        // convId -> {t, src}
const TTL_MS = 4000;

let wired = false;

function emitTo(convId, payload) {
  const set = listenersByConv.get(convId);
  if (!set) return;
  for (const fn of set) { try { fn(payload); } catch {} }
}

function scheduleAutoOff(convId, src) {
  const now = Date.now();
  lastSeen.set(convId, { t: now, src: src || null });
  setTimeout(() => {
    const last = lastSeen.get(convId) || { t: 0, src: null };
    if (Date.now() - last.t >= TTL_MS) {
      emitTo(convId, { isTyping: false, src: last.src || undefined });
    }
  }, TTL_MS + 10);
}

export function attachTypingSocketListener() {
  if (wired) return;
  wired = true;

  socketClient.on("typing", (payload) => {
    try {
      const from = payload.from || payload.sender || payload.wallet || null;
      const to   = payload.to   || payload.target || payload.peer   || null;
      const v    = (typeof payload.isTyping === "boolean")
        ? payload.isTyping
        : (typeof payload.typing === "boolean" ? payload.typing : true);

      const cid = payload.convId || (from && to ? canonicalConvId(from, to) : null);
      if (!cid) return;

      emitTo(cid, { isTyping: !!v, from, to, src: "socket" });
      if (v === true) scheduleAutoOff(cid, "socket");
    } catch {}
  });
}

export function onTyping(convId, cb) {
  if (!convId || typeof cb !== "function") return () => {};
  if (!listenersByConv.has(convId)) listenersByConv.set(convId, new Set());
  const set = listenersByConv.get(convId);
  set.add(cb);
  return () => { try { set.delete(cb); } catch {} };
}

export function sendTyping({ from, to, isTyping }) {
  if (!from || !to) return false;
  try {
    const ok = socketClient.send("typing", { from, to, isTyping: !!isTyping, ts: Date.now(), convId: canonicalConvId(from, to) });
    return !!ok;
  } catch { return false; }
}

export function emitTypingLocal({ from, to, isTyping, convId }) {
  const cid = convId || (from && to ? canonicalConvId(from, to) : null);
  if (!cid) return false;
  try {
    emitTo(cid, { isTyping: !!isTyping, from, to, src: "rtc" });
    if (isTyping === true) scheduleAutoOff(cid, "rtc");
    return true;
  } catch { return false; }
}

export default { attachTypingSocketListener, onTyping, sendTyping, emitTypingLocal };
