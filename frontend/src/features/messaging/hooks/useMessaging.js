// src/features/messaging/hooks/useMessaging.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribe, getState, actions, convId as canonicalConvId } from "@features/messaging/store/messagesStore.js";
import { useMessagingSDK } from "@features/messaging/contexts/MessagingProvider.jsx";
import { useRtcDialer } from "./useRtcDialer.js";
import * as relay from "../clients/relayClient.js";
import socketClient from "../clients/socketClient.js";
import { encryptText, encryptPayload, decryptPayload, importConversationKey } from "../e2e/e2e.js";
import { prepareInlineAttachment } from "../services/attachments.js";
import {
  onTyping as onTypingEvent,
  sendTyping as sendTypingEvent,
} from "../services/typingService.js";
import { MESSAGING } from "@shared/config/env.js";
import { trackMessageSent } from "../utils/rtcTelemetry.js";
import { createDebugLogger } from "@shared/utils/debug.js";
// 🔧 REMOVED: import { fetchIceServers } from "@features/messaging/clients/iceApi.js"; // no existe

// ---- pequeña ayuda para suscribirse al store (con cleanup correcto)
function useStoreSlice(selector) {
  const [slice, setSlice] = useState(() => selector(getState()));
  useEffect(() => {
    const off = subscribe((s) => setSlice(selector(s)));
    return off;
  }, [selector]);
  return slice;
}

export default function useMessaging({
  selfWallet,
  peerWallet,
  sharedKeyBase64,
}) {
  const { authReady } = useMessagingSDK() || {};
  const { ensureRtc, getRtc, isRtcReady } = useRtcDialer();

  const convId = useMemo(() => canonicalConvId(selfWallet, peerWallet), [selfWallet, peerWallet]);

  const selMessages = useCallback((s) => s.byConversation?.[convId] || [], [convId]);
  const selPresence = useCallback((s) => !!s.presence?.[peerWallet], [peerWallet]);
  const selTyping   = useCallback((s) => !!s.typing?.[convId], [convId]);
  const selError    = useCallback((s) => s.lastError, []);

  const messages  = useStoreSlice(selMessages);
  const presence  = useStoreSlice(selPresence);
  const isTyping  = useStoreSlice(selTyping);
  const lastError = useStoreSlice(selError);
  const localTypingSentAtRef = useRef(new Map());

  const [convKey, setConvKey] = useState(null);
  const decryptWarnedRef = useRef(new Set());
  const [keyReady, setKeyReady] = useState(false);
  const debugE2EE = useMemo(
    () => createDebugLogger("E2EE", { envKey: "VITE_DEBUG_E2EE_LOGS" }),
    []
  );
  const debugMsg = useMemo(
    () => createDebugLogger("msg", { envKey: "VITE_DEBUG_MSG_LOGS" }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sharedKeyBase64) {
        try { debugE2EE('key-source:none'); } catch {}
        setConvKey(null);
        setKeyReady(false);
        return;
      }
      try {
        try { debugE2EE('key-source:present', { len: (sharedKeyBase64 || '').length }); } catch {}
        const key = await importConversationKey(sharedKeyBase64);
        if (!cancelled) {
          setConvKey(key);
          setKeyReady(true);
          try { debugE2EE('key-import:ok'); } catch {}
        }
      } catch (e) {
        if (!cancelled) {
          setConvKey(null);
          setKeyReady(false);
          try { debugE2EE('key-import:fail', { message: e?.message || String(e) }); } catch {}
          actions.setError?.(`E2E key import failed: ${e?.message || e}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sharedKeyBase64]);

  useEffect(() => {
    decryptWarnedRef.current.clear();
  }, [convId]);

  const dataChannelReady = isRtcReady(peerWallet);
  const shouldPrepareRtc = MESSAGING.USE_WEBRTC_FOR_TEXT && !MESSAGING.FORCE_RELAY;

  useEffect(() => {
    if (!shouldPrepareRtc) return;
    if (!authReady || !peerWallet || !selfWallet) return;
    // Pre-dial
    ensureRtc(peerWallet).catch(error => {
      console.warn('[useMessaging] pre-dial failed', { peer: peerWallet, error });
    });
    // 🔧 Suprimimos el temporizador de restart ICE basado en TTL (dependía de un import que no existe)
    return () => {};
  }, [authReady, peerWallet, selfWallet, ensureRtc, shouldPrepareRtc]);

  useEffect(() => {
    if (!selfWallet || !peerWallet || !convId) return;
    const off = onTypingEvent(convId, (ev) => {
      if (dataChannelReady && ev?.src === 'socket') return;
      if (ev?.src === 'socket') {
        if (!ev?.from) return;
        if (peerWallet && ev.from !== peerWallet) return;
        if (ev?.to && selfWallet && ev.to !== selfWallet) return;
        if (ev?.convId && ev.convId !== convId) return;
      }
      if (ev?.from && selfWallet && ev.from === selfWallet) return;
      actions.setTyping?.(convId, !!ev?.isTyping);
    });
    return () => { try { off?.(); } catch {} };
  }, [convId, selfWallet, peerWallet, dataChannelReady]);

  // 🔧 Acepto timeoutMs (ya lo pasas desde ChatWindow)
  const sendText = useCallback(async (text, { prefer = "auto", timeoutMs } = {}) => {
    const clientId = (globalThis?.crypto?.randomUUID?.() || `m_${Date.now()}`);
    const openTimeoutMs = Number.isFinite(timeoutMs) ? timeoutMs : (MESSAGING.RTC_OPEN_TIMEOUT_MS || 2300);

    const cryptoKey = convKey;
    if (!cryptoKey) {
      try {
        debugE2EE('sendText:key-missing', { convId });
      } catch {}
      return { ok: false, reason: "e2e-key-missing" };
    }

    let envelope = null, aad = null;
    try {
      aad = `cid:${convId}|from:${selfWallet}|to:${peerWallet}`;
      envelope = await encryptText(text, cryptoKey, aad);
    } catch (e) {
      console.warn("[msg] sendText FAIL", { reason: e?.message || e, status: e?.status });
      return { ok: false, reason: "encrypt-failed" };
    }

    // 🔧 Añadir kind para UI/normalizador
    actions.upsertMessage?.(convId, {
      clientId, from: selfWallet, to: peerWallet, kind: "text", type: "text", sender: "me",
      status: "pending", sentAt: Date.now(), text,
    });

    try {
      const wsConnected = socketClient.isConnected();
      const peerOnline = !!presence;
      const rtcEligible = peerOnline;
      const webrtcEnabled = MESSAGING.USE_WEBRTC_FOR_TEXT && !MESSAGING.FORCE_RELAY;
      const shouldTryRtc = prefer !== "relay" && wsConnected && webrtcEnabled;

      const lastErr = socketClient.getLastRtcError?.(convId);
      const ineligible = !!(lastErr && (lastErr.reason === 'target_not_rtc_eligible' || lastErr.reason === 'sender_not_rtc_eligible'));

      debugMsg('sendText:start', {
        convId,
        len: text?.length,
        dataChannelReady,
        rtcEligible,
        presence: peerOnline,
        wsConnected,
        webrtcEnabled,
        shouldTryRtc,
        lastRtcError: lastErr?.reason || null,
      });

      if (shouldTryRtc && prefer !== "relay" && !ineligible) {
        try { await ensureRtc(peerWallet); } catch {}
        const rtcClient = getRtc(peerWallet);
        try { await rtcClient?.maybeKickNegotiation?.(); } catch {}
        if (rtcClient) {
          const opened = await rtcClient.waitForChatOpen(openTimeoutMs);
          if (opened) {
            const payload = { kind: "text", envelope, from: selfWallet, to: peerWallet };
            const ok = rtcClient.sendChat(payload);
            if (ok) {
              actions.upsertMessage?.(convId, { clientId, status: "sent", via: "rtc" });
              trackMessageSent(convId, "rtc");
              debugMsg('sendText:success', { via: 'rtc', clientId });
              return { ok: true, via: "rtc", clientId };
            }
          } else {
            debugMsg('rtc:skip', { peer: peerWallet, reason: 'dc-timeout', timeoutMs: openTimeoutMs });
          }
        } else {
          debugMsg('rtc:skip', { peer: peerWallet, reason: 'no-client' });
        }
      } else {
        const reason = !webrtcEnabled ? 'feature-off' :
                      !wsConnected   ? 'ws-closed' :
                      ineligible     ? 'rtc-error-ineligible' :
                                        'prefer-relay';
        debugMsg('rtc:skip', { peer: peerWallet, reason });
      }

      debugMsg('rtc:fallback', { peer: peerWallet, reason: 'rtc-failed-or-skipped' });

      const res = await relay.sendText({
        toWallet: peerWallet,
        clientId,
        text,
        key: cryptoKey,
        meta: { kind: "text", convId, from: selfWallet, to: peerWallet },
        force: true,
      });

      actions.upsertMessage?.(convId, {
        clientId,
        id: res.id,
        status: "sent",
        deliveredAt: res.deliveredAt || null,
        via: "relay",
        forced: true,
        warning: res.warning || null
      });

      trackMessageSent(convId, "relay");
      debugMsg('sendText:success', { via: 'relay', clientId, forced: true });
      return {
        ok: true,
        via: "relay",
        serverId: res.id,
        deliveredAt: res.deliveredAt || null,
        forced: true,
        warning: res.warning
      };
    } catch (e) {
      actions.markFailed?.(convId, clientId, e?.message || "send-failed");
      console.warn("[msg] sendText FAIL", { reason: e?.message || e, status: e?.status });
      return { ok: false, reason: e?.message || "send-failed" };
    }
  }, [convKey, convId, selfWallet, peerWallet, presence, dataChannelReady, ensureRtc, getRtc, debugE2EE, debugMsg]);

  const sendAttachmentInline = useCallback(async ({ base64, mime, kind, w, h, durMs }, { clientId, forceRelayIfOnline = true } = {}) => {
    const localId = clientId || (globalThis?.crypto?.randomUUID?.() || `f_${Date.now()}`);
    const cryptoKey = convKey;
    if (!cryptoKey) {
      return { ok: false, reason: "e2e-key-missing" };
    }

    try {
      let box = base64, iv = null;
      if (cryptoKey) {
        const aad = `cid:${convId}|from:${selfWallet}|to:${peerWallet}|media`;
        const env = await encryptPayload({ type: 'bin', binBase64: base64 }, cryptoKey, aad);
        box = env.cipher; iv = env.iv;
      }

      actions.upsertMessage?.(convId, {
        clientId: localId, from: selfWallet, to: peerWallet,
        kind: kind || "media-inline", type: "file", status: "pending", sentAt: Date.now(),
        base64, mime, w, h, durMs,
      });

      const res = await relay.enqueue({
        to: peerWallet,
        box,
        iv,
        msgId: localId,
        mime,
        meta: { kind: "media", w, h, durMs, convId },
        force: presence && forceRelayIfOnline,
      });

      actions.upsertMessage?.(convId, {
        clientId: localId, id: res.id || res.serverId, status: "sent", deliveredAt: res.deliveredAt || null, via: "relay",
        forced: !!res.forced, warning: res.warning || null
      });
      return { ok: true, via: "relay", serverId: res.id || res.serverId, deliveredAt: res.deliveredAt || null, forced: !!res.forced, warning: res.warning };

    } catch (e) {
      if ((e.status === 409 || e.code === "recipient-online")) {
        const rtcClient = getRtc(peerWallet);
        const opened = await rtcClient?.waitForChatOpen?.(1500);
        if (opened) {
          let ok = false;
          if (cryptoKey) {
            let box = base64, iv = null;
            try {
              const aad = `cid:${convId}|from:${selfWallet}|to:${peerWallet}|media`;
              const env = await encryptPayload({ type: 'bin', binBase64: base64 }, cryptoKey, aad);
              box = env.cipher; iv = env.iv;
            } catch {}
            ok = rtcClient.sendChat({
              kind: kind || "media-inline",
              envelope: { iv, cipher: box, aad: `cid:${convId}|from:${selfWallet}|to:${peerWallet}|media` },
              mime, w, h, durMs,
              meta: { convId },
              from: selfWallet,
              to: peerWallet,
            });
          } else {
            ok = rtcClient.sendChat({
              kind: kind || "media-inline",
              mime,
              base64,
              w, h, durMs,
              meta: { convId },
              from: selfWallet,
              to: peerWallet,
            });
          }
          if (ok) {
            actions.upsertMessage?.(convId, { clientId: localId, status: "sent", via: "rtc-fallback" });
            return { ok: true, via: "rtc-fallback" };
          }
        }
        try {
          const forced = await relay.enqueue({
            to: peerWallet,
            box: base64,
            iv: null,
            msgId: localId,
            mime,
            meta: { kind: "media", w, h, durMs, convId },
            force: true,
          });
          actions.upsertMessage?.(convId, {
            clientId: localId, id: forced.id || forced.serverId, status: "sent", deliveredAt: forced.deliveredAt || null, via: "relay",
            forced: true, warning: forced.warning || null
          });
          return { ok: true, via: "relay", serverId: forced.id || forced.serverId, deliveredAt: forced.deliveredAt || null, forced: true, warning: forced.warning };
        } catch (e2) {
          actions.markFailed?.(convId, localId, e2.message || e.message || "send-failed");
          return { ok: false, reason: e2.code || e2.message || e.code || e.message, status: e2.status || e.status };
        }
      }
      actions.markFailed?.(convId, localId, e.message || "send-failed");
      return { ok: false, reason: e.code || e.message, status: e.status };
    }
  }, [convId, convKey, peerWallet, selfWallet, presence, getRtc]);

  const sendAttachment = useCallback(async (file, { forceRelayIfOnline = true } = {}) => {
    const clientId = (globalThis?.crypto?.randomUUID?.() || `f_${Date.now()}`);
    if (!convKey) {
      try { debugE2EE('sendAttachment:key-missing', { convId }); } catch {}
      return { ok: false, reason: "e2e-key-missing" };
    }
    try {
      const prepared = await prepareInlineAttachment(file);
      return await sendAttachmentInline(
        { base64: prepared.base64, mime: prepared.mime, kind: prepared.kind, w: prepared.w, h: prepared.h, durMs: prepared.durMs },
        { clientId, forceRelayIfOnline }
      );
    } catch (e) {
      return { ok: false, reason: e?.message || "send-failed" };
    }
  }, [convKey, convId, sendAttachmentInline, debugE2EE]);

  const setTyping = useCallback((flag) => {
    if (isRtcReady(peerWallet)) {
      const rtcClient = getRtc(peerWallet);
      try { rtcClient?.sendTyping?.({ typing: !!flag, convId }); return; } catch {}
    }
    try {
      sendTypingEvent({ from: selfWallet, to: peerWallet, isTyping: !!flag });
      if (flag) localTypingSentAtRef.current.set(convId, Date.now());
    } catch {}
  }, [getRtc, peerWallet, convId, selfWallet, isRtcReady]);

  const [decMessages, setDecMessages] = useState(messages);
  useEffect(() => {
    (async () => {
      const cryptoKey = convKey;
      if (!cryptoKey || !Array.isArray(messages) || !messages.length) {
        setDecMessages(messages); return;
      }
      const out = [];
      for (const m of messages) {
        let mm = { ...m };
        const env = (m?.envelope && (m.envelope.iv && m.envelope.cipher)) ? m.envelope : m;
        if (env?.iv && env?.cipher) {
          const candidates = [];
          const hasMediaHint = !!(m?.mime || m?.kind === 'media' || m?.kind === 'media-inline' || env?.aad?.includes('|media'));
          const storedAad = env?.aad || (typeof m?.aad === 'string' ? m.aad : null);
          if (storedAad) candidates.push(storedAad);

          const cid = m?.convId || convId;
          const fromW = m?.from || null;
          const toW   = m?.to   || null;
          if (cid && fromW && toW) {
            const base = `cid:${cid}|from:${fromW}|to:${toW}`;
            if (hasMediaHint) candidates.push(`${base}|media`);
            candidates.push(`${base}|v:1`);
            candidates.push(base);
          }
          candidates.push(undefined);

          let decrypted = null;
          let lastError = null;
          const seen = new Set();
          for (const candidate of candidates) {
            if (seen.has(candidate)) continue;
            seen.add(candidate);
            const aadCandidate = typeof candidate === 'string' ? candidate : undefined;
            try {
              const obj = await decryptPayload({ iv: env.iv, cipher: env.cipher, aad: aadCandidate }, cryptoKey);
              decrypted = obj;
              break;
            } catch (e) {
              lastError = e;
            }
          }

          if (decrypted?.type === 'text') mm.text = decrypted.text;
          if (decrypted?.type === 'bin')  mm.base64 = decrypted.binBase64;

          if (!decrypted && lastError) {
            try {
              const warnKey = `${m?.id || m?.clientId || m?.serverId || 'no-id'}:${m?.timestamp || m?.sentAt || ''}`;
              if (!decryptWarnedRef.current.has(warnKey)) {
                decryptWarnedRef.current.add(warnKey);
                const details = {
                  convId: m?.convId || convId,
                  kind: m?.kind,
                  hasAad: !!storedAad,
                  aadCandidates: candidates.filter(Boolean),
                  from: m?.from || null,
                  to: m?.to || null,
                  err: lastError?.message || String(lastError),
                };
                if (debugE2EE.enabled) debugE2EE('decrypt failed', details);
                else console.warn('[E2EE] decrypt failed', details);
              }
            } catch {}
          }
        }
        out.push(mm);
      }
      setDecMessages(out);
    })();
  }, [messages, convId, convKey, selfWallet, peerWallet, debugE2EE]);

  return useMemo(() => ({
    messages: decMessages,
    presence: { online: presence },
    isTyping,
    canUseDataChannel: dataChannelReady,
    lastError,
    sendText,
    sendAttachment,
    sendAttachmentInline,
    setTyping,
    e2ee: { keyReady },
  }), [decMessages, presence, isTyping, dataChannelReady, lastError, keyReady, sendText, sendAttachment, sendAttachmentInline, setTyping]);
}
