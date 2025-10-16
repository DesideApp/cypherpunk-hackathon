// src/features/messaging/clients/signalApi.js
import { authedFetchJson as fetchJson } from "@features/messaging/clients/fetcher.js";
import { getWalletSignature } from "@shared/services/tokenService.js";
import { canonicalConvId } from "@features/messaging/domain/id.js";

async function httpPost(path, body) {
  const walletSig = getWalletSignature();
  const url = `/api/v1/signal${path}`;
  return fetchJson(url, {
    method: "POST",
    body: JSON.stringify(body || {}),
    headers: { ...(walletSig ? { "X-Wallet-Signature": walletSig } : {}) },
  });
}

function tryEmitSignal(socket, payload) {
  if (socket?.emitSignal) {
    try { return !!socket.emitSignal(payload); } catch { return false; }
  }
  if (socket?.send && typeof socket.isConnected === "function" && socket.isConnected()) {
    try { socket.send("signal", payload); return true; } catch { return false; }
  }
  return false;
}

export function publishOffer({ socket, from, to, sdp }) {
  const convId = (from && to) ? canonicalConvId(from, to) : undefined;
  const payload = { sender: from, target: to, signal: { type: "offer", sdp }, convId };
  if (tryEmitSignal(socket, payload)) return Promise.resolve({ via: "ws" });
  return httpPost("", { kind: "offer", from, to, sdp });
}

export function publishAnswer({ socket, from, to, sdp }) {
  const convId = (from && to) ? canonicalConvId(from, to) : undefined;
  const payload = { sender: from, target: to, signal: { type: "answer", sdp }, convId };
  if (tryEmitSignal(socket, payload)) return Promise.resolve({ via: "ws" });
  return httpPost("", { kind: "answer", from, to, sdp });
}

export function publishIceCandidate({ socket, from, to, candidate }) {
  const convId = (from && to) ? canonicalConvId(from, to) : undefined;
  const payload = { sender: from, target: to, signal: { type: "ice-candidate", candidate }, convId };
  if (tryEmitSignal(socket, payload)) return Promise.resolve({ via: "ws" });
  return httpPost("", { kind: "ice", from, to, candidate });
}

export function notifyPresence({ socket, state = "online", who }) {
  if (socket?.emit && socket.connected === true) {
    try { socket.emit("presence:update", { state, who, ts: Date.now() }); return Promise.resolve({ via: "ws" }); }
    catch { /* fall through */ }
  }
  if (socket?.send && typeof socket.isConnected === "function" && socket.isConnected()) {
    try { socket.send("presence:update", { state, who, ts: Date.now() }); return Promise.resolve({ via: "ws" }); }
    catch { /* fall through */ }
  }
  return httpPost("/presence", { state, who, ts: Date.now() });
}
