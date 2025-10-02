// src/features/messaging/ui/ChatWindow.jsx
import React, { useMemo, useCallback, useEffect } from "react";
import ChatHeader from "./ChatHeader";
import WritingPanel from "./WritingPanel";
import ChatMessages from "./ChatMessages";

import useMessaging from "@features/messaging/hooks/useMessaging";
import { ENV, MESSAGING } from "@shared/config/env.js";
import { useSocket } from "@shared/socket";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { base64ToUtf8 } from "@shared/utils/base64.js";
import "./ChatWindow.css";

/* -------------------- helpers -------------------- */
function inferKindFromMime(mime = "") {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "binary";
}

function normalizeSelected(sel) {
  if (!sel) return { pubkey: null, nickname: null, avatar: null };
  if (typeof sel === "string") return { pubkey: sel, nickname: null, avatar: null };
  const key = sel.pubkey || sel.wallet || sel.id || null;
  return { pubkey: key, nickname: sel.nickname || sel.name || null, avatar: sel.avatar || null };
}

// Mapear mensaje genérico → shape UI (usa text/media; no 'payload')
function toUiMessage(m, myWallet) {
  if (!m) return null;

  // Sender
  const sender =
    m.sender ||
    (m.from ? (m.from === myWallet ? "me" : "other")
            : (m.author ? (m.author === myWallet ? "me" : "other")
                        : "other"));

  // Timestamps
  const timestamp =
    m.timestamp ||
    m.sentAt ||
    (m.createdAt ? (typeof m.createdAt === "string" ? Date.parse(m.createdAt) : m.createdAt) : Date.now());

  // Texto
  let text = m.text || m.body?.text || null;
  if (!text && m.box && !m.iv && !m.envelope && (!m.mime || m.mime === "text/plain")) {
    try { text = base64ToUtf8(m.box); } catch {}
  }
  if (!text && m.kind === "text" && typeof m.payload?.text === "string") {
    text = m.payload.text;
  }

  // Media
  let media = m.media || null;
  if (!media) {
    // a) inline (RTC)
    if ((m.kind === "media-inline" || m.kind === "media") && (m.base64 || m.payload?.base64)) {
      const mime = m.mime || m.payload?.mime || "application/octet-stream";
      media = {
        kind: inferKindFromMime(mime),
        base64: m.base64 || m.payload?.base64,
        mime,
        width: m.w || m.payload?.w,
        height: m.h || m.payload?.h,
        durationMs: m.durMs || m.payload?.durMs,
      };
    }
    // b) relay encolado
    else if (m.mime && m.box && (m.meta?.kind === "media" || inferKindFromMime(m.mime) !== "binary")) {
      media = {
        kind: inferKindFromMime(m.mime),
        base64: m.box,
        mime: m.mime,
        width: m.meta?.w,
        height: m.meta?.h,
        durationMs: m.meta?.durMs,
      };
    }
  }

  const deliveredAt = m.deliveredAt || null;
  const status = m.status || (deliveredAt ? "delivered" : "sent");

  return {
    id: m.id || m.serverId || m.clientId || undefined,
    sender,
    text: text || null,
    media: media || null,
    timestamp,
    deliveredAt,
    status,
    isEncrypted: !!(m.iv || m.envelope),
    isBackedUp: !!m.isBackedUp,
    via: m.via,
  };
}

/* ===================== Componente ===================== */

export default function ChatWindow({ selectedContact, activePanel, setActivePanel }) {
  const { isConnected, isConnecting } = useSocket();
  const { pubkey: myWallet } = useAuthManager();

  // Contacto activo
  const selected = useMemo(() => normalizeSelected(selectedContact), [selectedContact]);
  const peerWallet = selected.pubkey || null;

  // Registro de wallet lo gestiona MessagingProvider (evita duplicar aquí)

  // Conversación activa: no gatear el typing por foco del DOM

  /* ---- Hook de mensajería ---- */
  const {
    messages: rawMessages,
    sendText,
    setTyping,
    e2ee,
  } = useMessaging({
    selfWallet: myWallet,
    peerWallet,
    // Grado-1 E2EE: requiere clave fija en env, si no existe no se envía
    sharedKeyBase64: (ENV.E2E_SHARED_KEY_BASE64 || '').trim() || null,
  });

  // Debug explícito de resolución de clave (ayuda a diagnósticos)
  useEffect(() => {
    const rawEnv = (ENV.E2E_SHARED_KEY_BASE64 || '').trim();
    const resolved = rawEnv || null;
    try {
      console.debug('[E2EE] resolve', {
        from: resolved ? 'env' : 'missing',
        envLen: resolved ? resolved.length : 0,
      });
    } catch {}
  }, [peerWallet]);

  // Mapear a shape UI
  const messages = useMemo(
    () => (Array.isArray(rawMessages) ? rawMessages.map((m) => toUiMessage(m, myWallet)).filter(Boolean) : []),
    [rawMessages, myWallet]
  );

  /* ---- envío (sin inserción aquí; la hace useMessaging) ---- */
  const onSendText = useCallback(
    async (plain) =>
      sendText(plain, {
        prefer: "auto",
        timeoutMs: MESSAGING.RTC_OPEN_TIMEOUT_MS || 1500,
      }),
    [sendText]
  );


  const hasContact = !!peerWallet;
  const canSend = !!(e2ee && e2ee.keyReady);

  return (
    <div className="chat-window">
      <ChatHeader
        selectedContact={selected}
        isConnected={isConnected}
        isConnecting={isConnecting}
      />

      <div className="chat-window-body">
        <div className="chat-window-messages">
          <ChatMessages
            key={peerWallet || "none"}
            messages={messages}
            selectedContact={peerWallet}
            activePanel={activePanel}
            setActivePanel={setActivePanel}
          />
        </div>

        <WritingPanel
          key={peerWallet || "none"}
          onSendText={onSendText}
          onTyping={setTyping}
          hasContact={hasContact}
          activePeer={peerWallet}
          isContactConfirmed={true}
          canSend={canSend}
        />
      </div>
    </div>
  );
}
