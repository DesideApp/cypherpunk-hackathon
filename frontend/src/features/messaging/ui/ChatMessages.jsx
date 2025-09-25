import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { FiArrowDown } from "react-icons/fi";
import MessageGroup from "./MessageGroup";
import { formatDate } from "@shared/utils/dateFormat.js";
import { base64ToUtf8 } from "@shared/utils/base64.js";
import "./ChatMessages.css";

/** Normaliza mensajes (garantiza .sender y conserva flags/status si existen) */
const normalizeMsg = (m) => {
  if (!m) return m;
  if (m.sender === "me" || m.sender === "other") return m;
  if (m.from === "me") return { ...m, sender: "me" };
  if (typeof m.from === "string") return { ...m, sender: "other" };
  // fallback defensivo para agrupar como recibido
  return { ...m, sender: m.sender || "other" };
};

/** Heurística: descodifica texto si viene en base64 y no está cifrado */
function maybeDecodePlainText(msg) {
  if (!msg || msg.text || msg.isEncrypted) return msg;
  const looksText = !msg.mime || String(msg.mime).startsWith("text/");
  if (!msg.media && looksText && typeof msg.base64 === "string") {
    try {
      const txt = base64ToUtf8(msg.base64);
      return { ...msg, text: txt };
    } catch {
      return msg;
    }
  }
  return msg;
}

const ChatMessages = ({
  messages = [],               // live (UI + P2P + Relay mapeado en ChatWindow)
  selectedContact = null,
}) => {
  const chatContainerRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Historial de backup deshabilitado en esta versión
  const historyMessages = useMemo(() => [], []);
  const previews = useMemo(() => [], []);

  // 1) Unificar historial + live
  const allMessages = useMemo(() => {
    const fromProps = Array.isArray(messages) ? messages.map(normalizeMsg).map(maybeDecodePlainText) : [];
    const base = [...historyMessages, ...fromProps];
    base.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return base;
  }, [historyMessages, messages]);

  // 2) Agrupar por fecha y remitente contiguo
  const groupedByDate = useMemo(() => {
    if (!allMessages.length) return {};
    return allMessages.reduce((acc, msg) => {
      const date = formatDate(msg.timestamp);
      if (!acc[date]) acc[date] = [];
      const lastGroup = acc[date][acc[date].length - 1];
      const sameSender = lastGroup && lastGroup.sender === msg.sender;
      if (lastGroup && sameSender) lastGroup.messages.push(msg);
      else acc[date].push({ sender: msg.sender, messages: [msg] });
      return acc;
    }, {});
  }, [allMessages]);

  // 3) Auto-scroll al fondo si ya estabas abajo
  useEffect(() => {
    const el = chatContainerRef.current;
    if (el && isAtBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [allMessages, isAtBottom]);

  // 4) Scroll handler
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = () => {
    const el = chatContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  return (
    <main
      className="chat-messages"
      ref={chatContainerRef}
      onScroll={handleScroll}
      aria-live="polite"
      aria-relevant="additions"
    >
      {/* Sin contacto seleccionado → previews */}
      {!selectedContact && (
        <div className="chat-placeholder-container">
          {(previews?.length ?? 0) === 0 ? (
            <p className="chat-placeholder">🔍 Select a contact to start chatting.</p>
          ) : (
            <>
              <h2 className="chat-previews-title">💬 Recent conversations</h2>
              <ul className="chat-previews-list">
                {(previews ?? []).map((p, idx) => (
                  <li key={idx} className="preview-item">
                    <div className="preview-name">{p.displayName || p.chatId}</div>
                    <div className="preview-text">{p.lastMessageText}</div>
                    <div className="preview-date">{formatDate(p.lastMessageTimestamp)}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Con contacto → mensajes agrupados */}
      {selectedContact &&
        Object.entries(groupedByDate).map(([date, groups]) =>
          (groups || []).map((group, idx) => (
            <MessageGroup
              key={`${date}-${idx}`}
              date={idx === 0 ? date : null}
              messages={
                (group.messages || []).map((m) =>
                  m?.isEncrypted && !m?.text && !m?.media
                    ? { ...m, text: "🔒 Encrypted message", isPlaceholder: true }
                    : m
                )
              }
            />
          ))
        )}

      {/* Botón flotante scroll/panel */}
      {selectedContact && !isAtBottom && (
        <button
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <FiArrowDown size={20} />
        </button>
      )}
    </main>
  );
};

export default React.memo(ChatMessages);
