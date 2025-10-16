// src/features/messaging/hooks/useRtcDialer.js
// Hook para pre-dial RTC: mantiene WebRTCClients listos por conversación
// - Crea conexiones al abrir conversación
// - Renueva ICE cada ~420s
// - Observabilidad de estados RTC

import { useCallback, useEffect } from "react";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import socketClient from "@features/messaging/clients/socketClient.js";
import WebRTCClient from "@features/messaging/transports/webrtc/WebRTCClient.js";
import { convId as mkConvId } from "@features/messaging/store/messagesStore.js";
import { getIceServersSafe } from "@features/messaging/transports/webrtc/iceSupervisor.js";
import { MESSAGING } from "@shared/config/env.js";
import { rtcDebug } from "@shared/utils/rtcDebug.js";
import { createDebugLogger } from "@shared/utils/debug.js";

const ICE_REFRESH_INTERVAL = 420_000; // 7 minutos
const rtcClients = new Map(); // remoteId -> WebRTCClient
const iceRefreshTimers = new Map(); // remoteId -> timer
const lastAttempts = new Map(); // remoteId -> timestamp
const ATTEMPT_BACKOFF_MS = 10_000; // 10s backoff entre intentos fallidos

const DEBUG = createDebugLogger("rtc", { envKey: "VITE_DEBUG_RTC_LOGS" });

function logRtcEvent(event, data) {
  DEBUG(event, data);
}

export function useRtcDialer() {
  const { pubkey: myWallet } = useAuthManager();

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      // Limpiar todos los clientes y timers
      for (const [remoteId, client] of rtcClients.entries()) {
        try { client.close(); } catch {}
        const timer = iceRefreshTimers.get(remoteId);
        if (timer) clearInterval(timer);
      }
      rtcClients.clear();
      iceRefreshTimers.clear();
    };
  }, []);

  const createRtcClient = useCallback(async (remoteId) => {
    if (!myWallet || !remoteId) return null;
    
    try {
      // Obtener configuración ICE
      const iceServers = await getIceServersSafe();
      const hasCustomIce = iceServers && iceServers.length > 1; // más que solo STUN público
      
      rtcDebug('attempt', {
        peer: remoteId,
        hasIce: hasCustomIce,
        presence: socketClient.isPeerOnline(remoteId),
        timeoutMs: MESSAGING.RTC_OPEN_TIMEOUT_MS,
      });

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
            const off = socketClient.on('signal', (payload) => {
              // Backend OUT no incluye 'to'; filtramos por from y convId canónico
              const fromOk = payload?.from === remoteId;
              const toOk = !payload?.to || payload?.to === myWallet;
              let convOk = true;
              try { convOk = !payload?.convId || payload.convId === mkConvId(myWallet, remoteId); } catch {}
              if (fromOk && toOk && convOk) callback(payload);
            });
            return off;
          }
        },
        onStateChange: ({ pc, ice, chat }) => {
          if (chat === 'open') {
            logRtcEvent('opened', { peer: remoteId, ice, pc });
            // Marcar presencia por DC solo en apertura
            try { 
              // Importar actions aquí para evitar dependencia circular
              import('@features/messaging/store/messagesStore.js').then(({ actions }) => {
                actions.setPresence?.(remoteId, true);
              });
            } catch {}
          }
        },
        onChatMessage: (payload) => {
          // Manejar mensajes entrantes por RTC
          try {
            import('@features/messaging/store/messagesStore.js').then(({ actions, convId: mkConvId }) => {
              const convId = mkConvId(myWallet, remoteId);
              actions.addIncoming?.(convId, payload);
            });
          } catch {}
        },
        onTyping: ({ typing }) => {
          // Manejar typing por RTC
          try {
            import('@features/messaging/services/typingService.js').then(({ emitTypingLocal }) => {
              import('@features/messaging/store/messagesStore.js').then(({ convId: mkConvId }) => {
                const convId = mkConvId(myWallet, remoteId);
                emitTypingLocal({ from: remoteId, to: myWallet, isTyping: !!typing, convId });
              });
            });
          } catch {}
        },
        openTimeoutMs: MESSAGING.RTC_OPEN_TIMEOUT_MS,
      });

      // Iniciar como caller (pre-dial)
      await client.startAsCaller();
      
      // Programar renovación de ICE
      const refreshTimer = setInterval(async () => {
        try {
          await client.restartIce();
          rtcDebug('ice:refresh', { peer: remoteId });
        } catch (error) {
          console.warn('[rtc] ICE refresh failed', { peer: remoteId, error });
        }
      }, ICE_REFRESH_INTERVAL);
      
      iceRefreshTimers.set(remoteId, refreshTimer);
      rtcClients.set(remoteId, client);
      
      return client;
    } catch (error) {
      logRtcEvent('skip', { peer: remoteId, reason: 'create-failed', error: error.message });
      return null;
    }
  }, [myWallet]);

  const ensureRtc = useCallback(async (remoteId) => {
    if (!remoteId) return null;
    
    // Backoff: no intentar si falló recientemente
    const lastAttempt = lastAttempts.get(remoteId);
    if (lastAttempt && Date.now() - lastAttempt < ATTEMPT_BACKOFF_MS) {
      rtcDebug('backoff', { peer: remoteId, lastAttempt });
      return rtcClients.get(remoteId) || null;
    }
    
    // Si ya existe y está conectado, devolverlo
    const existing = rtcClients.get(remoteId);
    if (existing && !existing._closed) {
      return existing;
    }
    
    // Si existe pero está cerrado, limpiarlo
    if (existing) {
      try { existing.close(); } catch {}
      rtcClients.delete(remoteId);
      const timer = iceRefreshTimers.get(remoteId);
      if (timer) {
        clearInterval(timer);
        iceRefreshTimers.delete(remoteId);
      }
    }
    
    // Marcar intento
    lastAttempts.set(remoteId, Date.now());
    
    // Crear nuevo cliente
    const client = await createRtcClient(remoteId);
    
    // Si falló, programar backoff
    if (!client) {
      setTimeout(() => lastAttempts.delete(remoteId), ATTEMPT_BACKOFF_MS);
    }
    
    return client;
  }, [createRtcClient]);

  const getRtc = useCallback((remoteId) => {
    return rtcClients.get(remoteId) || null;
  }, []);

  const closeRtc = useCallback((remoteId) => {
    const client = rtcClients.get(remoteId);
    if (client) {
      try { client.close(); } catch {}
      rtcClients.delete(remoteId);
    }
    
    const timer = iceRefreshTimers.get(remoteId);
    if (timer) {
      clearInterval(timer);
      iceRefreshTimers.delete(remoteId);
    }
  }, []);

  const isRtcReady = useCallback((remoteId) => {
    const client = rtcClients.get(remoteId);
    return !!(client && client.chatDc?.readyState === 'open');
  }, []);

  const getRtcStats = useCallback(() => {
    const stats = {};
    for (const [remoteId, client] of rtcClients.entries()) {
      stats[remoteId] = {
        pc: client.pc?.connectionState || 'closed',
        ice: client.pc?.iceConnectionState || 'closed',
        chat: client.chatDc?.readyState || 'closed',
        typing: client.typingDc?.readyState || 'closed',
      };
    }
    return stats;
  }, []);

  return {
    ensureRtc,
    getRtc,
    closeRtc,
    isRtcReady,
    getRtcStats,
  };
}
