// src/shared/socket/index.jsx
// Provider + hook de Socket.IO para toda la app.
// API: useSocket() -> {
//   socket, isConnected, isConnecting,
//   registerWallet, emitSignal, onSignal,
//   emitTyping,  onTyping,
//   onRelayFlush, onPresence
// }
// Además, exporta getSocketInstance() para wrappers como socketClient.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { WS_URL } from "@shared/config/env.js";
import { getWalletSignature, hasSessionCookies } from "@shared/services/tokenService.js";
import { getCSRFToken } from "@shared/utils/csrf.js";
import { canonicalConvId } from "@features/messaging/domain/id.js";
import { emitRtcSignal } from "@features/messaging/clients/signalHelpers.js";

const SocketCtx = createContext(null);

// Referencia global para wrappers (socketClient.js)
let __socketInstance = null;
export function getSocketInstance() {
  return __socketInstance;
}

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  // Buses locales (evitan re-renders)
  const signalSubs = useRef(new Set());
  const typingSubs = useRef(new Set());
  const relayFlushSubs = useRef(new Set());
  const presenceSubs = useRef(new Set()); // 👈 nuevo

  useEffect(() => {
    const DEV = (typeof import.meta !== 'undefined' && import.meta.env && !!import.meta.env.DEV);
    const debug = (...args) => { if (DEV) { try { console.debug(...args); } catch (_) {} } };

    let cleanupSocket = null;

    const setupSocket = () => {
      const s = io(WS_URL, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        withCredentials: true,
        autoConnect: true,
        auth: (cb) => {
          try {
            const csrfToken = getCSRFToken() || undefined;
            const walletSig = getWalletSignature() || undefined;
            const payload = {};
            if (csrfToken) payload.csrfToken = csrfToken;
            if (walletSig) payload.walletSig = walletSig;
            debug("[Socket] auth payload", { hasCSRF: !!csrfToken, csrfLen: csrfToken?.length || 0, hasWalletSig: !!walletSig });
            cb(payload);
          } catch {
            debug("[Socket] auth payload (empty due to error)");
            cb({});
          }
        },
      });

      socketRef.current = s;
      __socketInstance = s;

      debug("[Socket] creating client", { WS_URL });

      const onConnect = () => {
        setIsConnected(true);
        setIsConnecting(false);
        try { debug("[Socket] connected", { id: s.id, transport: s?.io?.engine?.transport?.name }); } catch {}
      };
      const onDisconnect = (reason) => {
        setIsConnected(false);
        setIsConnecting(false);
        debug("[Socket] disconnected", { reason });
      };

      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
      s.on("connect_error", (err) => {
        debug("[Socket] connect_error", { message: err?.message, description: err?.description, data: err?.data, type: err?.type });
      });
      s.on("reconnect_attempt", (n) => debug("[Socket] reconnect_attempt", { attempt: n }));
      s.on("reconnect", (n) => debug("[Socket] reconnect", { attempt: n }));
      s.on("reconnect_error", (err) => debug("[Socket] reconnect_error", { message: err?.message }));
      s.on("reconnect_failed", () => debug("[Socket] reconnect_failed"));

      try {
        const engine = s?.io?.engine;
        if (engine && typeof engine.on === 'function') {
          engine.on("upgrade", (transport) => debug("[Socket] transport upgraded", { to: transport?.name }));
          engine.on("close", (reason) => debug("[Socket] engine close", { reason }));
        }
      } catch {}

      s.on('rtc:ack', (ack) => console.info('[rtc] ack', ack));
      s.on('rtc:error', (e) => console.warn('[rtc] error', e));

      const emitSignalUnified = (msg) => {
        signalSubs.current.forEach((fn) => { try { fn(msg); } catch {} });
      };

      s.on("rtc:offer", (p) => {
        const sdp = p?.sdp || p?.offer;
        emitSignalUnified({ type: "offer", sdp, from: p?.from || p?.sender, to: p?.to, convId: p?.convId });
      });
      s.on("rtc:answer", (p) => {
        const sdp = p?.sdp || p?.answer;
        emitSignalUnified({ type: "answer", sdp, from: p?.from || p?.sender, to: p?.to, convId: p?.convId });
      });
      s.on("rtc:candidate", (p) => {
        const cand = p?.candidate || p?.ice || p?.payload;
        if (!cand) return;
        emitSignalUnified({ type: "ice-candidate", candidate: cand, from: p?.from || p?.sender, to: p?.to, convId: p?.convId });
      });
      s.on("rtc:handshake", (p) => {
        const flat = (p?.signal && p?.signal?.type === 'handshake')
          ? { ...p.signal, from: p.from || p.sender, to: p.target || p.to, convId: p.convId, signalId: p.signalId }
          : { type: 'handshake', pub: p?.pub, pop: p?.pop, from: p?.from || p?.sender, to: p?.to, convId: p?.convId, signalId: p?.signalId };
        emitSignalUnified(flat);
      });

      s.on("signal", (payload) => {
        try {
          const sig = payload?.signal || payload;
          emitSignalUnified(sig);
        } catch {}
      });

      s.on("typing", (payload) => {
        typingSubs.current.forEach((fn) => { try { fn(payload); } catch {} });
      });

      s.on("relay:flush", (payload) => {
        debug("[Socket] relay:flush", { hasPayload: !!payload });
        relayFlushSubs.current.forEach((fn) => { try { fn(payload); } catch {} });
      });

      const emitPresence = (wallet, online, raw) => {
        if (!wallet) return;
        const ev = { wallet, online: !!online, raw };
        presenceSubs.current.forEach((fn) => { try { fn(ev); } catch {} });
      };

      const onPresenceUpdate = (p) => {
        const wallet = p?.userId || p?.wallet || p?.pubkey || p?.id;
        const online = (typeof p?.online === 'boolean') ? p.online : !!p?.isOnline;
        try { console.debug("[Socket] presence:update", { who: wallet, online, rtcEligible: p?.rtcEligible }); } catch {}
        debug("[Socket] presence:update", { who: wallet, online, rtcEligible: p?.rtcEligible });
        emitPresence(wallet, online, p);
      };
      s.on("presence:update", onPresenceUpdate);

      return () => {
        try {
          s.off("connect", onConnect);
          s.off("disconnect", onDisconnect);
          
          s.off("typing");
          s.off("relay:flush");
          s.off("rtc:ack");
          s.off("rtc:error");
          s.off("rtc:offer");
          s.off("rtc:answer");
          s.off("rtc:candidate");
          s.off("presence:update", onPresenceUpdate);
          s.close();
        } catch {}
        if (__socketInstance === s) __socketInstance = null;
        socketRef.current = null;
        setIsConnected(false);
        setIsConnecting(false);
      };
    };

    const ensureSocket = () => {
      if (!hasSessionCookies()) return;
      if (cleanupSocket) return;
      setIsConnecting(true);
      cleanupSocket = setupSocket();
    };

    if (hasSessionCookies()) {
      ensureSocket();
    } else {
      setIsConnecting(false);
    }

    const onSessionReady = () => {
      if (!hasSessionCookies()) return;
      ensureSocket();
    };

    const onSessionExpired = () => {
      if (cleanupSocket) {
        cleanupSocket();
        cleanupSocket = null;
      }
      setIsConnected(false);
      setIsConnecting(false);
    };

    window.addEventListener("sessionEstablished", onSessionReady);
    window.addEventListener("sessionRefreshed", onSessionReady);
    window.addEventListener("sessionExpired", onSessionExpired);

    return () => {
      window.removeEventListener("sessionEstablished", onSessionReady);
      window.removeEventListener("sessionRefreshed", onSessionReady);
      window.removeEventListener("sessionExpired", onSessionExpired);
      if (cleanupSocket) {
        cleanupSocket();
        cleanupSocket = null;
      }
      __socketInstance = null;
      socketRef.current = null;
    };
  }, []);

  const api = useMemo(() => ({
    socket: socketRef.current,
    isConnected,
    isConnecting,

    registerWallet: (pubkey) => {
      try {
        const s = socketRef.current;
        // Log explícito de registro (siempre, no solo en DEV)
        try { console.debug("[Socket] register emit", { pubkey }); } catch {}
        // Registrar listeners de ACK una sola vez para esta llamada
        try {
          const onRegistered = (payload) => {
            try { console.debug("[Socket] registered ack", payload || true); } catch {}
            try { s?.off?.('registered', onRegistered); } catch {}
          };
          s?.once?.('registered', onRegistered) || s?.on?.('registered', onRegistered);
        } catch {}
        // Emitir evento esperado por backend v1: 'register_wallet' con payload string
        const ok = s?.emit?.("register_wallet", String(pubkey || ""));
        // Log también el resultado de emit (DEV)
        try { const DEV = (typeof import.meta !== 'undefined' && import.meta.env && !!import.meta.env.DEV); if (DEV) console.debug("[Socket] register wallet", { pubkey, ok: !!ok, event: 'register_wallet' }); } catch {}
      } catch {}
    },

    // ---- Señales WebRTC ----
    emitSignal: (payload) => {
      try {
        const s = socketRef.current;
        if (!s) return;
        const signal = payload?.signal || payload;
        const to = payload?.target || payload?.to;
        const from = payload?.from || signal?.from;
        const convRaw = payload?.convId || signal?.convId;
        let convId = convRaw;
        try {
          if (from && to) {
            // ConvId canónico: [A,B].sort().join(':')
            convId = canonicalConvId(from, to);
          } else if (typeof convRaw === 'string' && convRaw.includes('::')) {
            // Compat de migración "A::B" → "A:B"
            convId = convRaw.replace('::', ':');
          }
        } catch {}
        const inferredType = signal?.type || (signal?.candidate ? 'candidate' : null);
        if (!inferredType) return;
        // Handshake por canal dedicado: wrap a envelope y emitir rtc:handshake
        if (inferredType === 'handshake') {
          const env = (payload?.signal?.type === 'handshake')
            ? { ...payload, from, to }
            : {
                from,
                sender: from,
                to,
                target: to,
                convId,
                signalId: payload?.signalId || signal?.signalId || (globalThis?.crypto?.randomUUID?.() || undefined),
                signal: { type: 'handshake', pub: payload?.pub || signal?.pub, pop: payload?.pop || signal?.pop },
              };
          try { s.emit('rtc:handshake', env); } catch {}
          return;
        }
        emitRtcSignal(s, inferredType, {
          from,
          to,
          convId,
          sdp: signal?.sdp,
          candidate: signal?.candidate,
        });
      } catch {}
    },
    onSignal: (cb) => {
      if (!cb) return () => {};
      signalSubs.current.add(cb);
      return () => { try { signalSubs.current.delete(cb); } catch {} };
    },

    // ---- Typing ----
    emitTyping: (payload) => {
      try { socketRef.current?.emit("typing", payload); } catch {}
    },
    onTyping: (cb) => {
      if (!cb) return () => {};
      typingSubs.current.add(cb);
      return () => { try { typingSubs.current.delete(cb); } catch {} };
    },

    // ---- Flush Relay ----
    onRelayFlush: (cb) => {
      if (!cb) return () => {};
      relayFlushSubs.current.add(cb);
      return () => { try { relayFlushSubs.current.delete(cb); } catch {} };
    },

    // ---- Presencia ----
    onPresence: (cb) => {
      if (!cb) return () => {};
      presenceSubs.current.add(cb);
      return () => { try { presenceSubs.current.delete(cb); } catch {} };
    },
    
    // ---- Reautenticación explícita tras login ----
    reconnectWithAuth: () => {
      try {
        const s = socketRef.current;
        if (!s) return false;
        s.auth = (cb) => {
          try {
            const csrfToken = getCSRFToken() || undefined;
            const walletSig = getWalletSignature() || undefined;
            const payload = {};
            if (csrfToken) payload.csrfToken = csrfToken;
            if (walletSig) payload.walletSig = walletSig;
            try { const DEV = (typeof import.meta !== 'undefined' && import.meta.env && !!import.meta.env.DEV); if (DEV) console.debug("[Socket] reconnect auth payload", { hasCSRF: !!csrfToken, csrfLen: csrfToken?.length || 0, hasWalletSig: !!walletSig }); } catch {}
            cb(payload);
          } catch {
            cb({});
          }
        };
        // Fuerza nuevo handshake para que viajen cookies+CSRF actuales
        try { const DEV = (typeof import.meta !== 'undefined' && import.meta.env && !!import.meta.env.DEV); if (DEV) console.debug("[Socket] reconnectWithAuth: disconnect→connect"); } catch {}
        try { s.disconnect(); } catch {}
        try { s.connect(); } catch {}
        return true;
      } catch {
        return false;
      }
    },
  }), [isConnected, isConnecting]);

  return <SocketCtx.Provider value={api}>{children}</SocketCtx.Provider>;
}

export function useSocket() {
  return useContext(SocketCtx) || {
    socket: null,
    isConnected: false,
    isConnecting: true,
    registerWallet: () => {},
    emitSignal: () => {},
    onSignal: () => () => {},
    emitTyping: () => {},
    onTyping: () => () => {},
    onRelayFlush: () => () => {},
    onPresence: () => () => {},   // 👈 compat por si falta Provider
    reconnectWithAuth: () => false,
  };
}

export default { SocketProvider, useSocket, getSocketInstance };
