import ENV from "@shared/config/env.js";
import { rtcDebug } from "@shared/utils/rtcDebug.js";
import { authedFetchJson as fetchWithAuth } from "@features/messaging/clients/fetcher.js";
import { getIceServersSafe } from "./iceSupervisor.js";
import { canonicalConvId } from "@features/messaging/domain/id.js";

const RTC_CONFIG = ENV?.RTC_CONFIG || {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
const DATA_CHANNELS = { chat: "chat", typing: "typing" };

export default class WebRTCClient {
  constructor({
    localId,
    remoteId,
    rtcConfig = RTC_CONFIG,
    signal,            // { send(signal), on(cb)->off }
    onStateChange,
    onChatMessage,
    onTyping,
    allowStart,
    openTimeoutMs = 10000,
  } = {}) {
    this.localId = localId;
    this.remoteId = remoteId;
    this.convId = canonicalConvId(localId, remoteId);
    this._baseRtcConfig = rtcConfig;
    this.signal = signal;
    this.onStateChange = onStateChange || (() => {});
    this.onChatMessage = onChatMessage || (() => {});
    this.onTyping = onTyping || (() => {});
    this.allowStart = allowStart;
    this.openTimeoutMs = openTimeoutMs;

    this.makingOffer = false;
    this.ignoreOffer = false;
    this.polite = String(localId) > String(remoteId);

    this.pendingIce = [];
    this._restarting = false;
    this._closed = false;
    this._contactCache = { t: 0, ok: true };

    this.pc = null;
    this.chatDc = null;
    this.typingDc = null;
    this._initPromise = null;

    this._initializeAsync();
  }

  async _initializeAsync() {
    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  async _doInitialize() {
    try {
      const iceServers = await getIceServersSafe();
      const rtcConfig = { ...this._baseRtcConfig, iceServers };
      this.pc = new RTCPeerConnection(rtcConfig);
      this._wirePeerConnection();
      this._wireSignal();
    } catch (error) {
      console.error("Error inicializando WebRTCClient:", error);
      this.pc = new RTCPeerConnection(this._baseRtcConfig);
      this._wirePeerConnection();
      this._wireSignal();
    }
  }

  async _ensurePeerConnection() {
    if (this._initPromise) await this._initPromise;
    return this.pc;
  }

  _emitState() {
    if (this._closed || !this.pc) return;
    this.onStateChange({
      pc: this.pc.connectionState,
      ice: this.pc.iceConnectionState,
      chat: this.chatDc?.readyState || "closed",
      typing: this.typingDc?.readyState || "closed",
    });
  }

  async _defaultAllowStart() {
    const now = Date.now();
    if (now - this._contactCache.t < 3000) return this._contactCache.ok;
    try {
      const r = await fetchWithAuth(`/api/v1/contacts/status/${this.remoteId}`, { method: "GET", sensitive: true });
      const ok = r?.error ? true : !!r?.isConfirmed;
      this._contactCache = { t: now, ok };
      return ok;
    } catch {
      this._contactCache = { t: now, ok: true };
      return true;
    }
  }

  async _canStart() {
    try {
      if (this.allowStart) return !!(await this.allowStart(this.remoteId));
      return await this._defaultAllowStart();
    } catch { return true; }
  }

  _attachDc(dc) {
    if (!dc?.label) return;
    if (dc.label === DATA_CHANNELS.chat) this.chatDc = dc;
    if (dc.label === DATA_CHANNELS.typing) this.typingDc = dc;

    dc.onopen = () => { this._emitState(); rtcDebug('dc:open', { peer: this.remoteId, label: dc.label }); };
    dc.onclose = () => { this._emitState(); rtcDebug('dc:close', { peer: this.remoteId, label: dc.label }); };
    dc.onerror = () => this._emitState();

    dc.onmessage = (ev) => {
      if (dc.label === DATA_CHANNELS.typing) {
        let p = null; try { p = JSON.parse(ev.data); } catch {}
        const typing = typeof p?.typing === "boolean" ? p.typing : false;
        try { this.onTyping({ typing }); } catch {}
        return;
      }
      let payload = ev.data; try { payload = JSON.parse(ev.data); } catch {}
      try { this.onChatMessage(payload); } catch {}
    };
  }

  _wirePeerConnection() {
    const pc = this.pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        rtcDebug('ice:out', { peer: this.remoteId, has: true });
        this.signal?.send({
          type: "ice-candidate",
          candidate: ev.candidate,
          to: this.remoteId,
          convId: this.convId,
        });
      }
    };

    pc.oniceconnectionstatechange = async () => {
      rtcDebug('ice:state', { peer: this.remoteId, state: pc.iceConnectionState });
      this._emitState();
      const st = pc.iceConnectionState;
      if ((st === "disconnected" || st === "failed") && !this._restarting) {
        this._restarting = true;
        try { await this.restartIce(); } catch {}
        this._restarting = false;
      }
    };

    pc.onconnectionstatechange = () => {
      rtcDebug('pc:state', { peer: this.remoteId, state: pc.connectionState });
      this._emitState();
    };

    pc.ondatachannel = (ev) => {
      rtcDebug('dc:event', { peer: this.remoteId, label: ev?.channel?.label });
      this._attachDc(ev.channel);
    };

    pc.onnegotiationneeded = async () => {
      if (this._closed) return;
      try {
        if (this.makingOffer || pc.signalingState !== "stable") return;
        this.makingOffer = true;
        await pc.setLocalDescription(await pc.createOffer());
        rtcDebug('sld:offer:done', { peer: this.remoteId, state: pc.signalingState });
        // 👇 incluir SIEMPRE to + convId
        this.signal?.send({ type: "offer", sdp: pc.localDescription, to: this.remoteId, convId: this.convId });
        rtcDebug('offer:out', { peer: this.remoteId, convId: this.convId });
      } catch {
      } finally {
        this.makingOffer = false;
      }
    };
  }

  _wireSignal() {
    this._offSignal = this.signal?.on?.(async (msg) => {
      if (!msg || this._closed || !this.pc) return;
      try {
        if (msg.type === "offer") {
          rtcDebug('srd:offer:begin', { peer: this.remoteId });
          const offerCollision = this.makingOffer || this.pc.signalingState !== "stable";
          this.ignoreOffer = !this.polite && offerCollision;
          if (this.ignoreOffer) return;

          if (offerCollision) {
            try { await this.pc.setLocalDescription({ type: "rollback" }); } catch {}
          }
          rtcDebug('srd:offer:set:begin', { peer: this.remoteId });
          await this.pc.setRemoteDescription(msg.sdp);
          rtcDebug('srd:offer:set:done', { peer: this.remoteId });

          if (this.pendingIce.length) {
            for (const c of this.pendingIce.splice(0)) { try { await this.pc.addIceCandidate(c); } catch {} }
          }
          rtcDebug('answer:create:begin', { peer: this.remoteId });
          const answer = await this.pc.createAnswer();
          rtcDebug('answer:create:got', { peer: this.remoteId });
          await this.pc.setLocalDescription(answer);
          rtcDebug('sld:answer:done', { peer: this.remoteId });
          // 👇 incluir SIEMPRE to + convId
          this.signal?.send({ type: "answer", sdp: this.pc.localDescription, to: this.remoteId, convId: this.convId });
          rtcDebug('answer:out', { peer: this.remoteId, convId: this.convId });
          return;
        }

        if (msg.type === "answer") {
          if (this.ignoreOffer) return;
          rtcDebug('srd:answer:begin', { peer: this.remoteId });
          rtcDebug('srd:answer:set:begin', { peer: this.remoteId });
          await this.pc.setRemoteDescription(msg.sdp);
          rtcDebug('srd:answer:set:done', { peer: this.remoteId });
          if (this.pendingIce.length) {
            for (const c of this.pendingIce.splice(0)) { try { await this.pc.addIceCandidate(c); } catch {} }
          }
          return;
        }

        if (msg.type === "ice-candidate" || msg.type === "ice") {
          const candidate = msg.candidate || msg.ice || null;
          if (!candidate) return;
          if (this.pc.remoteDescription) { try { await this.pc.addIceCandidate(candidate); } catch {} }
          else { this.pendingIce.push(candidate); }
          rtcDebug('ice:in', { peer: this.remoteId, queued: !this.pc.remoteDescription });
          return;
        }
      } catch {
        // tolerante
      }
    });
  }

  async startAsCaller() {
    await this._ensurePeerConnection();
    if (!(await this._canStart())) return;
    this._attachDc(this.pc.createDataChannel(DATA_CHANNELS.chat, { ordered: true }));
    this._attachDc(this.pc.createDataChannel(DATA_CHANNELS.typing, { ordered: true }));
    queueMicrotask(() => this.maybeKickNegotiation());
  }

  async maybeKickNegotiation() {
    try {
      await this._ensurePeerConnection();
      if (this._closed) return;
      if (this.pc.signalingState !== "stable") return;
      if (!this.makingOffer) {
        this.makingOffer = true;
        await this.pc.setLocalDescription(await this.pc.createOffer());
        // 👇 incluir SIEMPRE to + convId
        this.signal?.send({ type: "offer", sdp: this.pc.localDescription, to: this.remoteId, convId: this.convId });
      }
    } catch {
    } finally { this.makingOffer = false; }
  }

  async waitForChatOpen(timeoutMs = this.openTimeoutMs) {
    if (this.chatDc?.readyState === "open") return true;
    const start = Date.now();
    while (!this._closed && Date.now() - start < timeoutMs) {
      if (this.chatDc?.readyState === "open") return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    const opened = this.chatDc?.readyState === "open";
    try { rtcDebug('dc:wait', { peer: this.remoteId, opened, timeoutMs }); } catch {}
    return opened;
  }

  sendChat(payload) {
    if (this.chatDc?.readyState !== "open") return false;
    const data = typeof payload === "string" ? payload : JSON.stringify(payload);
    try { this.chatDc.send(data); return true; } catch { return false; }
  }

  sendTyping(flagOrPayload) {
    if (this.typingDc?.readyState !== "open") return false;
    const payload = typeof flagOrPayload === "boolean" ? { typing: flagOrPayload } : flagOrPayload;
    try { this.typingDc.send(JSON.stringify(payload)); return true; } catch { return false; }
  }

  async restartIce() {
    try {
      await this._ensurePeerConnection();
      await this.pc.setLocalDescription(await this.pc.createOffer({ iceRestart: true }));
      // 👇 incluir SIEMPRE to + convId
      this.signal?.send({ type: "offer", sdp: this.pc.localDescription, to: this.remoteId, convId: this.convId });
    } catch {}
  }

  close() {
    this._closed = true;
    try { this.chatDc?.close(); } catch {}
    try { this.typingDc?.close(); } catch {}
    try { this.pc?.close(); } catch {}
    try { this._offSignal && this._offSignal(); } catch {}
    this.chatDc = null;
    this.typingDc = null;
    this.pendingIce = [];
  }
}
