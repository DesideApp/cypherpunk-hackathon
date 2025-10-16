// src/features/messaging/clients/signalHelpers.js
// Helper sin dependencias del Provider para emitir señales RTC con shape unificado.
// Evita ciclos importando sólo utilidades puras.

import { canonicalConvId } from "@features/messaging/domain/id.js";

function normConvId(from, to, convRaw) {
  try {
    if (from && to) return canonicalConvId(from, to);
    if (typeof convRaw === 'string') return convRaw.replace('::', ':');
  } catch {}
  return convRaw || null;
}

function makeSignalId() {
  try { return globalThis?.crypto?.randomUUID?.() || null; } catch { return null; }
}

function toSdpObject(type, sdp) {
  if (!sdp) return null;
  return (typeof sdp === 'string') ? { type, sdp } : sdp;
}

function normalizeCandidate(cand) {
  if (!cand) return null;
  try { return (typeof cand.toJSON === 'function') ? cand.toJSON() : { candidate: cand.candidate, sdpMid: cand.sdpMid, sdpMLineIndex: cand.sdpMLineIndex }; }
  catch { return null; }
}

/**
 * Emite una señal RTC con shape unificado y convId canónico.
 * type: 'offer' | 'answer' | 'ice-candidate' | 'candidate'
 */
export function emitRtcSignal(socket, type, { from, to, convId, sdp, candidate }) {
  if (!socket) return false;
  const conv = normConvId(from, to, convId);
  const signalId = makeSignalId() || `sig_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

  if (type === 'offer') {
    const sdpObj = toSdpObject('offer', sdp);
    if (!sdpObj) return false;
    const payload = { type: 'offer', from, to, convId: conv, signalId, sdp: sdpObj };
    try { socket.emit('rtc:offer', payload, (ack) => console.info('[rtc] offer ack', ack)); } catch { return false; }
    return true;
  }
  if (type === 'answer') {
    const sdpObj = toSdpObject('answer', sdp);
    if (!sdpObj) return false;
    const payload = { type: 'answer', from, to, convId: conv, signalId, sdp: sdpObj };
    try { socket.emit('rtc:answer', payload, (ack) => console.info('[rtc] answer ack', ack)); } catch { return false; }
    return true;
  }
  if (type === 'ice-candidate' || type === 'candidate') {
    const normalized = normalizeCandidate(candidate);
    if (!normalized) return false;
    const payload = { type: 'candidate', from, to, convId: conv, signalId, candidate: normalized };
    try { socket.emit('rtc:candidate', payload, (ack) => console.info('[rtc] candidate ack', ack)); } catch { return false; }
    return true;
  }
  return false;
}

