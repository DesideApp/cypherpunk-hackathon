// src/features/messaging/MessagingProvider.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { useSocket } from "@shared/socket";
import { createInboxService } from "@features/messaging/services/inboxService.js";
import { attachTypingSocketListener } from "@features/messaging/services/typingService.js";
import { actions, convId as mkConvId } from "@features/messaging/store/messagesStore.js";
import socketClient from "@features/messaging/clients/socketClient.js";
import { getCSRFToken } from "@shared/utils/csrf.js";
import { setFeature } from "@shared/config/featureFlags.js";
import { MESSAGING } from "@shared/config/env.js";
import WebRTCClient from "@features/messaging/transports/webrtc/WebRTCClient.js";
import { getIceServersSafe } from "@features/messaging/transports/webrtc/iceSupervisor.js";
import { useRtcDialer } from "@features/messaging/hooks/useRtcDialer.js";

const MessagingContext = createContext({
  isRunning: false,
  lastFetchAt: null,
  refresh: () => {},
});

export function MessagingProvider({ children, pollMs = 4000 }) {
  const { isAuthenticated, pubkey: myWallet, ensureReady } = useAuthManager();
  const { isConnected, registerWallet, onRelayFlush, onPresence } = useSocket();

  const inboxRef = useRef(null);
  const [isRunning, setRunning] = useState(false);
  const [lastFetchAt, setLastFetchAt] = useState(null);

  // Typing listener global (idempotente)
  useEffect(() => {
    attachTypingSocketListener();
  }, []);

  // Presencia entrante → store (acepta { wallet, online })
  useEffect(() => {
    const off = onPresence?.((ev) => {
      const wallet = ev?.wallet || ev?.pubkey || ev?.id || null;
      const online = !!ev?.online;
      if (wallet) { try { actions?.setPresence?.(wallet, online); } catch {} }
    });
    return () => { try { off?.(); } catch {} };
  }, [onPresence]);

  // Delivered → marca mensajes como entregados
  useEffect(() => {
    const off = socketClient.on?.("delivered", (p) => {
      try {
        const clientId = p?.clientId || p?.clientMsgId || p?.localId || null;
        if (!clientId) return;
        const deliveredAtRaw = p?.deliveredAt || p?.ts || p?.timestamp || Date.now();
        const deliveredAt = typeof deliveredAtRaw === 'string' ? (Date.parse(deliveredAtRaw) || Date.now()) : Number(deliveredAtRaw) || Date.now();
        const conv = p?.convId || (p?.from && p?.to ? mkConvId(p.from, p.to) : null);
        if (!conv) return;
        actions.markDelivered?.(conv, clientId, deliveredAt);
      } catch {}
    });
    return () => { try { off?.(); } catch {} };
  }, []);

  // authReady requiere cookie/CSRF presente además de auth y wallet
  const csrfPresent = !!getCSRFToken();
  const authReady = !!isAuthenticated && !!myWallet && csrfPresent;

  // Inicializa toggles locales desde ENV
  useEffect(() => {
    try { setFeature('WEBRTC', !!MESSAGING?.USE_WEBRTC_FOR_TEXT); } catch {}
    try { setFeature('RELAY_ONLY', !!MESSAGING?.FORCE_RELAY); } catch {}
  }, []);

  // Re-registro de wallet cuando el socket conecta + heartbeat
  useEffect(() => {
    if (isConnected && myWallet && authReady) {
      try { registerWallet(myWallet); } catch {}
      try { socketClient.startHeartbeat(); } catch {}
    } else {
      try { socketClient.stopHeartbeat(); } catch {}
    }
  }, [isConnected, myWallet, authReady, registerWallet]);

  // Enlaza 'relay:flush' del socket → debounce interno de inboxService
  const onFlushBind = useCallback(
    (onFlushCb) => onRelayFlush?.(() => { try { onFlushCb?.(); } catch {} }),
    [onRelayFlush]
  );

  // Arranque/paro del inboxService con authReady
  useEffect(() => {
    if (!authReady) {
      try { inboxRef.current?.stop?.(); } catch {}
      inboxRef.current = null;
      setRunning(false);
      return;
    }

    const svc = createInboxService({
      selfWallet: myWallet,
      pollMs,
      enabled: true,
      onFlushBind,
    });
    inboxRef.current = svc;
    svc.start();
    setRunning(true);

    const t = setInterval(() => setLastFetchAt(Date.now()), Math.max(15000, pollMs * 2));

    return () => {
      try { svc.stop(); } catch {}
      inboxRef.current = null;
      setRunning(false);
      clearInterval(t);
    };
  }, [authReady, myWallet, pollMs, onFlushBind]);

  // Pausa/reanudación ante auth:stale → ensureReady → reset+start
  useEffect(() => {
    const onAuthStale = async () => {
      try { inboxRef.current?.stop?.(); } catch {}
      setRunning(false);
      try {
        const ok = await ensureReady();
        if (ok) {
          if (inboxRef.current) {
            try { inboxRef.current.reset?.(); } catch {}
            try { inboxRef.current.start?.(); } catch {}
            setRunning(true);
          }
        }
      } catch {}
    };
    window.addEventListener('auth:stale', onAuthStale);
    return () => window.removeEventListener('auth:stale', onAuthStale);
  }, [ensureReady]);

  const value = useMemo(() => ({
    isRunning,
    lastFetchAt,
    authReady,
    refresh: () => inboxRef.current?.fetchNow?.(),
  }), [isRunning, lastFetchAt, authReady]);

  return (
    <MessagingContext.Provider value={value}>
      <RtcAutoAnswerBridge />
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessagingSDK() {
  return useContext(MessagingContext);
}

// Auto-answer de ofertas RTC aunque el callee no haya abierto el chat
function RtcAutoAnswerBridge() {
  const { pubkey: myWallet } = useAuthManager();
  const { getRtc } = useRtcDialer();
  const passiveRef = useRef(new Map()); // remoteId -> WebRTCClient

  useEffect(() => {
    if (!myWallet) return;

    const passiveMap = passiveRef.current;

    const createPassive = async (remoteId, initialOffer) => {
      if (!remoteId) return null;
      if (getRtc(remoteId) || passiveMap.get(remoteId)) return passiveMap.get(remoteId);
      try {
        const iceServers = await getIceServersSafe();
        const client = new WebRTCClient({
          localId: myWallet,
          remoteId,
          rtcConfig: { iceServers },
          signal: {
            send: (signal) => {
              const cid = mkConvId(myWallet, remoteId);
              socketClient.send('signal', { ...signal, to: remoteId, from: myWallet, convId: cid });
            },
            on: (callback) => {
              // Entregar inmediatamente la oferta que detonó la creación
              if (initialOffer) {
                try { callback(initialOffer); } catch {}
              }
              const off = socketClient.on('signal', (payload) => {
                const fromOk = payload?.from === remoteId;
                const toOk = !payload?.to || payload?.to === myWallet;
                let convOk = true;
                try { convOk = !payload?.convId || payload.convId === mkConvId(myWallet, remoteId); } catch {}
                if (fromOk && toOk && convOk) callback(payload);
              });
              return off;
            },
          },
          onStateChange: ({ chat, ice, pc }) => {
            if (chat === 'open') {
              try {
                actions.setPresence?.(remoteId, true);
                console.debug('[rtc] dc open (passive)', { peer: remoteId, ice, pc });
              } catch {}
            }
          },
          onChatMessage: (payload) => {
            try { actions.addIncoming?.(mkConvId(myWallet, remoteId), payload); } catch {}
          },
          onTyping: ({ typing }) => {
            try {
              import('@features/messaging/services/typingService.js').then(({ emitTypingLocal }) => {
                const convId = mkConvId(myWallet, remoteId);
                emitTypingLocal({ from: remoteId, to: myWallet, isTyping: !!typing, convId });
              });
            } catch {}
          },
        });
        passiveMap.set(remoteId, client);
        return client;
      } catch {
        return null;
      }
    };

    const off = socketClient.on('signal', (msg) => {
      if (!msg || msg.type !== 'offer') return;
      const conv = msg?.convId || null;
      const isForMe = (msg?.to && msg.to === myWallet) || (
        conv && typeof conv === 'string' && conv.split(':').includes(String(myWallet))
      );
      if (!isForMe) return;

      let remoteId = msg?.from || null;
      if (!remoteId && conv) {
        try {
          const parts = String(conv).split(':');
          if (parts.length === 2) {
            remoteId = parts[0] === String(myWallet) ? parts[1] : (parts[1] === String(myWallet) ? parts[0] : null);
          }
        } catch {}
      }
      if (!remoteId) return;

      createPassive(remoteId, msg).catch(() => {});
    });

    return () => {
      try { off?.(); } catch {}
      for (const [, c] of passiveMap.entries()) {
        try { c.close(); } catch {}
      }
      passiveMap.clear();
    };
  }, [myWallet, getRtc]);

  return null;
}
