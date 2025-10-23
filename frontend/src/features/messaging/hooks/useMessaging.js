// src/features/messaging/hooks/useMessaging.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribe, getState, actions, convId as canonicalConvId, nextClientMsgId } from "@features/messaging/store/messagesStore.js";
import { useMessagingSDK } from "@features/messaging/contexts/MessagingProvider.jsx";
import { useRtcDialer } from "./useRtcDialer.js";
import { addRecent } from "@features/messaging/utils/recentConversations.js";
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
import { buildAAD } from "@shared/e2e/aad.js";
import { createAgreement } from "@features/messaging/services/agreementService.js";
import { assertAllowed } from "@features/messaging/config/blinkSecurity.js";
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

  const registerRecent = useCallback((preview) => {
    if (!peerWallet) return;
    try {
      addRecent({
        chatId: peerWallet,
        lastMessageText: preview?.text ?? "",
        lastMessageTimestamp: preview?.timestamp ?? Date.now(),
      });
    } catch {}
  }, [peerWallet]);

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
  const debugTransport = useMemo(
    () => createDebugLogger("transport", { envKey: "VITE_DEBUG_TRANSPORT_LOGS" }),
    []
  );
  const debugAgreement = useMemo(
    () => createDebugLogger("agreement", { envKey: "VITE_DEBUG_AGREEMENT_LOGS" }),
    []
  );

  useEffect(() => {
    if (!convId || !selfWallet) return;
    try { actions.sanitizeConversation?.(convId, selfWallet); } catch {}
  }, [convId, selfWallet]);

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

    let envelope = null;
    let aad = null;
    try {
      aad = buildAAD({ convId, from: selfWallet, to: peerWallet, isMedia: false });
      envelope = await encryptText(text, cryptoKey, aad);
      try { debugE2EE('send-text', { convId, aad, len: text?.length || 0 }); } catch {}
    } catch (e) {
      console.warn("[msg] sendText FAIL", { reason: e?.message || e, status: e?.status });
      return { ok: false, reason: "encrypt-failed" };
    }

    // 🔧 Añadir kind para UI/normalizador
    actions.upsertMessage?.(convId, {
      clientId,
      from: selfWallet,
      to: peerWallet,
      kind: "text",
      type: "text",
      sender: "me",
      status: "pending",
      sentAt: Date.now(),
      text,
      envelope,
      aad,
    }, selfWallet);
    registerRecent({ text, timestamp: Date.now() });

    try {
      const wsConnected = socketClient.isConnected();
      const peerOnline = !!presence;
      const webrtcEnabled = MESSAGING.USE_WEBRTC_FOR_TEXT && !MESSAGING.FORCE_RELAY;
      const lastErr = socketClient.getLastRtcError?.(convId);
      const ineligible = !!(lastErr && (lastErr.reason === 'target_not_rtc_eligible' || lastErr.reason === 'sender_not_rtc_eligible'));

      const shouldTryRtc =
        prefer !== "relay" &&
        wsConnected &&
        webrtcEnabled &&
        dataChannelReady &&
        !ineligible;

      debugMsg('sendText:start', {
        convId,
        len: text?.length,
        dataChannelReady,
        rtcEligible: peerOnline,
        presence: peerOnline,
        wsConnected,
        webrtcEnabled,
        shouldTryRtc,
        lastRtcError: lastErr?.reason || null,
      });

      if (shouldTryRtc) {
        try { await ensureRtc(peerWallet); } catch {}
        const rtcClient = getRtc(peerWallet);
        try { await rtcClient?.maybeKickNegotiation?.(); } catch {}
        if (rtcClient) {
          const opened = await rtcClient.waitForChatOpen(openTimeoutMs);
          if (opened) {
            const payload = {
              kind: "text",
              envelope: { ...envelope, aad },
              from: selfWallet,
              to: peerWallet,
              convId,
              aad,
            };
            const ok = rtcClient.sendChat(payload);
            if (ok) {
              actions.upsertMessage?.(convId, { clientId, status: "sent", via: "rtc", aad }, selfWallet);
              trackMessageSent(convId, "rtc");
              debugMsg('sendText:success', { via: 'rtc', clientId });
              try {
                debugTransport('sent-text', {
                  direction: 'outgoing',
                  transport: 'rtc',
                  convId,
                  clientId,
                });
              } catch {}
              return { ok: true, via: "rtc", clientId };
            }
          } else {
            debugMsg('rtc:skip', { peer: peerWallet, reason: 'dc-timeout', timeoutMs: openTimeoutMs });
          }
        } else {
          debugMsg('rtc:skip', { peer: peerWallet, reason: 'no-client' });
        }
      } else {
        const reason = !webrtcEnabled
          ? 'feature-off'
          : !wsConnected
            ? 'ws-closed'
            : ineligible
              ? 'rtc-error-ineligible'
              : !dataChannelReady
                ? 'dc-not-ready'
                : 'prefer-relay';
        debugMsg('rtc:skip', { peer: peerWallet, reason });
      }

      debugMsg('rtc:fallback', { peer: peerWallet, reason: 'rtc-failed-or-skipped' });

      const res = await relay.sendEnvelope({
        toWallet: peerWallet,
        clientId,
        envelope,
        meta: { kind: "text", convId, from: selfWallet, to: peerWallet, aad },
        force: true,
      });

      actions.upsertMessage?.(convId, {
        clientId,
        id: res.id,
        status: "sent",
        deliveredAt: res.deliveredAt || null,
        via: "relay",
        forced: true,
        warning: res.warning || null,
        aad,
      }, selfWallet);

      trackMessageSent(convId, "relay");
      debugMsg('sendText:success', { via: 'relay', clientId, forced: true });
      try {
        debugTransport('sent-text', {
          direction: 'outgoing',
          transport: 'relay',
          convId,
          clientId,
          forced: true,
        });
      } catch {}
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
  }, [convKey, convId, selfWallet, peerWallet, presence, dataChannelReady, ensureRtc, getRtc, debugE2EE, debugMsg, registerRecent]);

  const sendPaymentRequest = useCallback(
    async ({ token, amount, actionUrl, solanaActionUrl, dialToUrl, blinkApiUrl, note }) => {
      if (!convId || !selfWallet || !peerWallet) {
        return { ok: false, reason: "missing-context" };
      }
      if (!convKey) {
        debugE2EE('payment-request:key-missing', { convId });
        return { ok: false, reason: "e2e-key-missing" };
      }

      try {
        if (actionUrl) {
          try { assertAllowed(actionUrl, { feature: 'payment-request' }); } catch (err) {
            return { ok: false, reason: err?.message || 'blink-not-allowed' };
          }
        }

        const clientId = nextClientMsgId();
        const createdAt = Date.now();
        const request = {
          id: clientId,
          token,
          amount,
          payee: selfWallet,
          payer: peerWallet,
          actionUrl: actionUrl || null,
          solanaActionUrl: solanaActionUrl || null,
          dialToUrl: dialToUrl || null,
          blinkApiUrl: blinkApiUrl || null,
          note: note || null,
          createdAt,
        };

        const aad = buildAAD({ convId, from: selfWallet, to: peerWallet, isMedia: false });
        const envelope = await encryptPayload({ type: 'payment_request', request }, convKey, aad);

        actions.upsertMessage?.(convId, {
          clientId,
          from: selfWallet,
          to: peerWallet,
          sender: 'me',
          kind: 'payment-request',
          status: 'pending',
          sentAt: createdAt,
          createdAt,
          paymentRequest: request,
          envelope,
          aad,
        }, selfWallet);
        registerRecent({ text: `Payment request: ${amount || ''} ${token || ''}`.trim(), timestamp: createdAt });

        try {
          const res = await relay.sendEnvelope({
            toWallet: peerWallet,
            clientId,
            envelope,
          meta: {
            kind: 'payment-request',
            convId,
            from: selfWallet,
            to: peerWallet,
            token,
            amount,
            note: note || null,
          },
          force: true,
        });

          actions.upsertMessage?.(convId, {
            clientId,
            id: res?.id,
            status: 'sent',
            deliveredAt: res?.deliveredAt || null,
            via: 'relay',
            forced: true,
          }, selfWallet);
        } catch (relayError) {
          debugMsg('payment-request:relay-error', relayError?.message);
          actions.markFailed?.(convId, clientId, relayError?.message || 'send-failed');
          return { ok: false, reason: relayError?.message || 'send-failed' };
        }

        return { ok: true, request };
      } catch (error) {
        debugMsg('payment-request:error', error?.message);
        return { ok: false, reason: error?.message || 'payment-request-failed' };
      }
    }, [convId, selfWallet, peerWallet, convKey, debugE2EE, debugMsg, registerRecent]);

  const sendBlinkAction = useCallback(
    async ({
      kind = 'buy',
      token = null,
      amountInSol = null,
      amount = null,
      expectedOut = null,
      actionUrl = null,
      solanaActionUrl = null,
      dialToUrl = null,
      blinkApiUrl = null,
      txSig = null,
      source = 'local',
      meta = null,
    } = {}) => {
      if (!convId || !selfWallet || !peerWallet) {
        return { ok: false, reason: "missing-context" };
      }
      if (!convKey) {
        debugE2EE('blink-action:key-missing', { convId });
        return { ok: false, reason: "e2e-key-missing" };
      }

      try {
        if (actionUrl) {
          try {
            assertAllowed(actionUrl, { feature: 'blink-action' });
          } catch (err) {
            return { ok: false, reason: err?.message || 'blink-not-allowed' };
          }
        }

        const clientId = nextClientMsgId();
        const createdAt = Date.now();
        const resolvedAmount = amountInSol ?? amount ?? null;

        const blink = {
          id: clientId,
          kind: kind || 'buy',
          token: token || null,
          amountInSol: resolvedAmount,
          expectedOut: expectedOut ?? null,
          actionUrl: actionUrl || null,
          solanaActionUrl: solanaActionUrl || null,
          dialToUrl: dialToUrl || null,
          blinkApiUrl: blinkApiUrl || null,
          txSig: txSig || null,
          source: source || 'local',
          meta: meta || null,
          createdAt,
        };

        const aad = buildAAD({ convId, from: selfWallet, to: peerWallet, isMedia: false });
        const envelope = await encryptPayload({ type: 'blink_action', blink }, convKey, aad);

        actions.upsertMessage?.(convId, {
          clientId,
          from: selfWallet,
          to: peerWallet,
          sender: 'me',
          kind: 'blink-action',
          status: 'pending',
          sentAt: createdAt,
          createdAt,
          blinkAction: blink,
          envelope,
          aad,
        }, selfWallet);

        const recentLabelParts = [
          'Blink',
          kind ? kind.toUpperCase() : null,
          token || null,
        ].filter(Boolean);
        registerRecent({
          text: recentLabelParts.join(' '),
          timestamp: createdAt,
        });

        try {
          const res = await relay.sendEnvelope({
            toWallet: peerWallet,
            clientId,
            envelope,
            meta: {
              kind: 'blink-action',
              convId,
              from: selfWallet,
              to: peerWallet,
              token: token || null,
              blinkKind: kind || 'buy',
            },
            force: true,
          });

          actions.upsertMessage?.(convId, {
            clientId,
            id: res?.id,
            status: 'sent',
            deliveredAt: res?.deliveredAt || null,
            via: 'relay',
            forced: true,
          }, selfWallet);
        } catch (relayError) {
          debugMsg('blink-action:relay-error', relayError?.message);
          actions.markFailed?.(convId, clientId, relayError?.message || 'send-failed');
          return { ok: false, reason: relayError?.message || 'send-failed' };
        }

        return { ok: true, blink };
      } catch (error) {
        debugMsg('blink-action:error', error?.message);
        return { ok: false, reason: error?.message || 'blink-action-failed' };
      }
    },
    [convId, selfWallet, peerWallet, convKey, debugE2EE, debugMsg, registerRecent]
  );

  const sendAgreement = useCallback(
    async ({ title, body, amount, token, payer, payee, deadline }) => {
      if (!convId || !selfWallet || !peerWallet) {
        return { ok: false, reason: "missing-context" };
      }
      if (!convKey) {
        debugE2EE('agreement:key-missing', { convId });
        return { ok: false, reason: "e2e-key-missing" };
      }

      try {
        const payload = {
          title: String(title || '').trim(),
          body: body ? String(body).trim() : null,
          amount: amount ? String(amount).trim() : null,
          token: token ? String(token).toUpperCase() : null,
          payer,
          payee,
          deadline: deadline || null,
          participants: [selfWallet, peerWallet],
          conversationId: convId,
          createdBy: selfWallet,
        };

        const response = await createAgreement(payload);
        if (response?.error) {
          debugAgreement('create-error', { convId, reason: response.message });
          return { ok: false, reason: response.message || "agreement-create-failed" };
        }

        const rawAgreement = response?.agreement || response?.data?.agreement || response;
        const agreement = {
          ...rawAgreement,
          participants: rawAgreement?.participants || [selfWallet, peerWallet],
          createdBy: rawAgreement?.createdBy || selfWallet,
        };
        const receipt = response?.receipt || {
          status: 'pending_b',
          hash: response?.hash || null,
          txSigB: null,
          txSigA: null,
        };
        debugAgreement('created', { convId, agreementId: agreement?.id, payer, payee });
        const messageId = agreement?.id ? `${agreement.id}:signer_b` : nextClientMsgId();
        const aad = buildAAD({ convId, from: selfWallet, to: peerWallet, isMedia: false });
        const envelope = await encryptPayload({ type: 'agreement', agreement, receipt }, convKey, aad);
        const createdAt = Date.now();

        const previewText = agreement?.title ? `Agreement: ${agreement.title}` : 'Agreement created';

        actions.upsertMessage?.(convId, {
          clientId: messageId,
          from: selfWallet,
          to: peerWallet,
          sender: 'me',
          kind: 'agreement',
          status: 'pending',
          sentAt: createdAt,
          createdAt,
          agreement,
          receipt,
          envelope,
          aad,
          meta: {
            agreementId: agreement?.id || null,
            clientId: messageId,
            messageId,
            kind: 'agreement',
            convId,
            role: 'signer_b',
            status: receipt?.status || 'pending_b',
          },
        }, selfWallet);
        registerRecent({ text: previewText, timestamp: createdAt });
        return { ok: true, agreement };
      } catch (error) {
        console.warn('[agreement] create failed', error);
        debugAgreement('create-error', { message: error?.message });
        return { ok: false, reason: error?.message || 'agreement-create-failed' };
      }
  }, [convId, selfWallet, peerWallet, convKey, registerRecent, debugAgreement]);

  const shareAgreementUpdate = useCallback(
    async ({ agreement, receipt, clientId, messageId }) => {
      if (!convId || !selfWallet || !peerWallet) {
        return { ok: false, reason: "missing-context" };
      }
      if (!convKey) {
        debugE2EE('agreement:key-missing', { convId });
        return { ok: false, reason: "e2e-key-missing" };
      }
      try {
        const finalId = clientId || messageId || agreement?.id || nextClientMsgId();
        const aad = buildAAD({ convId, from: selfWallet, to: peerWallet, isMedia: false });
        const envelope = await encryptPayload({ type: 'agreement', agreement, receipt }, convKey, aad);

        await relay.sendEnvelope({
          toWallet: peerWallet,
          clientId: finalId,
          envelope,
          meta: {
            kind: 'agreement',
            convId,
            from: selfWallet,
            to: peerWallet,
            agreementId: agreement?.id || null,
            messageId: finalId,
          },
          force: true,
        });

        return { ok: true };
      } catch (error) {
        debugAgreement('update-share-error', { message: error?.message });
        return { ok: false, reason: error?.message || 'agreement-update-share-failed' };
      }
    },
    [convId, selfWallet, peerWallet, convKey, debugAgreement],
  );

  const sendAttachmentInline = useCallback(async ({ base64, mime, kind, w, h, durMs }, { clientId, forceRelayIfOnline = true } = {}) => {
    const localId = clientId || (globalThis?.crypto?.randomUUID?.() || `f_${Date.now()}`);
    const cryptoKey = convKey;
    if (!cryptoKey) {
      return { ok: false, reason: "e2e-key-missing" };
    }

    const mediaAad = buildAAD({ convId, from: selfWallet, to: peerWallet, isMedia: true });
    let cipher = null;
    let iv = null;
    try {
      const env = await encryptPayload({ type: 'bin', binBase64: base64 }, cryptoKey, mediaAad);
      cipher = env.cipher;
      iv = env.iv;
      try { debugE2EE('send-media', { convId, aad: mediaAad, mime }); } catch {}
    } catch (err) {
      console.warn('[msg] sendAttachment encrypt FAIL', { reason: err?.message || err });
      return { ok: false, reason: "encrypt-failed" };
    }

    try {
      actions.upsertMessage?.(convId, {
        clientId: localId,
        from: selfWallet,
        to: peerWallet,
        kind: kind || "media-inline",
        type: "file",
        status: "pending",
        sentAt: Date.now(),
        base64,
        mime,
        w,
        h,
        durMs,
        envelope: { iv, cipher, aad: mediaAad },
        aad: mediaAad,
      }, selfWallet);
      registerRecent({ text: kind || "media", timestamp: Date.now() });

      const res = await relay.enqueue({
        to: peerWallet,
        box: cipher,
        iv,
        msgId: localId,
        mime,
        meta: { kind: "media", w, h, durMs, convId, from: selfWallet, to: peerWallet, aad: mediaAad },
        force: presence && forceRelayIfOnline,
      });

      actions.upsertMessage?.(convId, {
        clientId: localId,
        id: res.id || res.serverId,
        status: "sent",
        deliveredAt: res.deliveredAt || null,
        via: "relay",
        forced: !!res.forced,
        warning: res.warning || null,
        aad: mediaAad,
      }, selfWallet);
      try {
        debugTransport('sent-media', {
          direction: 'outgoing',
          transport: 'relay',
          convId,
          clientId: localId,
          forced: !!res.forced,
        });
      } catch {}
      return { ok: true, via: "relay", serverId: res.id || res.serverId, deliveredAt: res.deliveredAt || null, forced: !!res.forced, warning: res.warning };

    } catch (e) {
      if ((e.status === 409 || e.code === "recipient-online")) {
        const rtcClient = getRtc(peerWallet);
        const opened = await rtcClient?.waitForChatOpen?.(1500);
        if (opened) {
          const ok = rtcClient.sendChat({
            kind: kind || "media-inline",
            envelope: { iv, cipher, aad: mediaAad },
            mime,
            w,
            h,
            durMs,
            meta: { convId },
            from: selfWallet,
            to: peerWallet,
          });
          if (ok) {
            actions.upsertMessage?.(convId, { clientId: localId, status: "sent", via: "rtc-fallback", aad: mediaAad }, selfWallet);
            try {
              debugTransport('sent-media', {
                direction: 'outgoing',
                transport: 'rtc',
                convId,
                clientId: localId,
                note: 'fallback-rtc',
              });
            } catch {}
            return { ok: true, via: "rtc-fallback" };
          }
        }
        try {
          const forced = await relay.enqueue({
            to: peerWallet,
            box: cipher,
            iv,
            msgId: localId,
            mime,
            meta: { kind: "media", w, h, durMs, convId, from: selfWallet, to: peerWallet, aad: mediaAad },
            force: true,
          });
          actions.upsertMessage?.(convId, {
            clientId: localId, id: forced.id || forced.serverId, status: "sent", deliveredAt: forced.deliveredAt || null, via: "relay",
            forced: true, warning: forced.warning || null
          }, selfWallet);
          try {
            debugTransport('sent-media', {
              direction: 'outgoing',
              transport: 'relay',
              convId,
              clientId: localId,
              forced: true,
              note: 'rtc-409-forced',
            });
          } catch {}
          return { ok: true, via: "relay", serverId: forced.id || forced.serverId, deliveredAt: forced.deliveredAt || null, forced: true, warning: forced.warning };
        } catch (e2) {
          actions.markFailed?.(convId, localId, e2.message || e.message || "send-failed");
          return { ok: false, reason: e2.code || e2.message || e.code || e.message, status: e2.status || e.status };
        }
      }
      actions.markFailed?.(convId, localId, e.message || "send-failed");
      return { ok: false, reason: e.code || e.message, status: e.status };
    }
  }, [convId, convKey, peerWallet, selfWallet, presence, getRtc, registerRecent]);

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
      if (!convKey || !Array.isArray(messages) || messages.length === 0) {
        setDecMessages(messages);
        return;
      }

      const processed = [];
      for (const msg of messages) {
        const mm = { ...msg };
        const env = (msg?.envelope && msg.envelope.iv && msg.envelope.cipher) ? msg.envelope : msg;

        if (env?.iv && env?.cipher) {
          const cid = msg?.convId || convId;
          const isMedia = !!(msg?.mime || msg?.kind === 'media' || msg?.kind === 'media-inline');
          let aad = typeof msg?.aad === 'string' ? msg.aad : (typeof env?.aad === 'string' ? env.aad : null);

          if (!aad && cid) {
            try {
              if (msg?.from && msg?.to) {
                aad = buildAAD({ convId: cid, from: msg.from, to: msg.to, isMedia });
              } else if (peerWallet && selfWallet) {
                const senderIsMe = msg?.sender === 'me' || msg?.from === selfWallet;
                const fromHint = senderIsMe ? selfWallet : peerWallet;
                const toHint = senderIsMe ? (msg?.to || peerWallet) : selfWallet;
                aad = buildAAD({ convId: cid, from: fromHint, to: toHint, isMedia });
              }
            } catch {
              aad = null;
            }
          }

          if (aad) {
            try {
              const payload = await decryptPayload({ iv: env.iv, cipher: env.cipher, aad }, convKey);
              if (payload?.type === 'text') mm.text = payload.text;
              if (payload?.type === 'bin') mm.base64 = payload.binBase64;
              if (payload?.type === 'agreement') {
                mm.agreement = payload.agreement || null;
                mm.receipt = payload.receipt || null;
                mm.kind = mm.kind || 'agreement';
              }
              if (payload?.type === 'payment_request') {
                mm.paymentRequest = payload.request || null;
                mm.kind = mm.kind || 'payment-request';
              }
              if (payload?.type === 'blink_action') {
                mm.blinkAction = payload.blink || null;
                mm.kind = mm.kind || 'blink-action';
              }
              mm.aad = aad;
            } catch (error) {
              const warnKey = `${msg?.id || msg?.clientId || msg?.serverId || 'no-id'}:${msg?.timestamp || msg?.sentAt || ''}`;
              if (!decryptWarnedRef.current.has(warnKey)) {
                decryptWarnedRef.current.add(warnKey);
                const details = {
                  convId: cid,
                  kind: msg?.kind,
                  from: msg?.from || null,
                  to: msg?.to || null,
                  err: error?.message || String(error),
                };
                if (debugE2EE.enabled) debugE2EE('decrypt failed', details);
                else console.warn('[E2EE] decrypt failed', details);
              }
              mm.isEncrypted = true;
            }
          } else {
            mm.isEncrypted = true;
          }
        }

        if ((mm.kind === 'agreement' || msg?.kind === 'agreement')) {
          mm.kind = 'agreement';
          if (!mm.agreement && msg?.agreement) mm.agreement = msg.agreement;
          if (!mm.receipt && msg?.receipt) mm.receipt = msg.receipt;
        }

        if ((mm.kind === 'payment-request' || msg?.kind === 'payment-request')) {
          mm.kind = 'payment-request';
          if (!mm.paymentRequest && msg?.paymentRequest) mm.paymentRequest = msg.paymentRequest;
        }

        if ((mm.kind === 'blink-action' || msg?.kind === 'blink-action')) {
          mm.kind = 'blink-action';
          if (!mm.blinkAction && msg?.blinkAction) mm.blinkAction = msg.blinkAction;
        }

        processed.push(mm);
      }

      setDecMessages(processed);
    })();
  }, [messages, convId, convKey, selfWallet, peerWallet, debugE2EE]);

  return useMemo(() => ({
    messages: decMessages,
    presence: { online: presence },
    isTyping,
    canUseDataChannel: dataChannelReady,
    lastError,
    keyReady,
    sendText,
    sendPaymentRequest,
    sendBlinkAction,
    sendAgreement,
    sendAttachment,
    sendAttachmentInline,
    shareAgreementUpdate,
    setTyping,
    e2ee: { keyReady },
  }), [decMessages, presence, isTyping, dataChannelReady, lastError, keyReady, sendText, sendPaymentRequest, sendBlinkAction, sendAgreement, sendAttachment, sendAttachmentInline, shareAgreementUpdate, setTyping]);
}
