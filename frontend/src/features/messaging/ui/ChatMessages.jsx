import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import MessageGroup from "./MessageGroup";
import ScrollToBottomButton from "./ScrollToBottomButton.jsx";
import { useLayout } from "@features/layout/contexts/LayoutContext.jsx";
import { formatDate } from "@shared/utils/dateFormat.js";
import { base64ToUtf8 } from "@shared/utils/base64.js";
import "./ChatMessages.css";

/** Normaliza mensajes (garantiza .sender y conserva flags/status si existen) */
const normalizeMsg = (m) => {
  if (!m) return m;
  const direction = m.direction || (m.sender === "me" ? "sent" : "received");
  const sender = direction === "sent" ? "me" : "other";
  return { ...m, direction, sender };
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
  const prevMessageCountRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const isScrollingRef = useRef(false); // Flag para detectar scroll manual
  const { isMobileLayout = false, leftbarExpanded, rightPanelOpen } = useLayout?.() || {};
  const [fabCenter, setFabCenter] = useState(null);

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
      const sameDirection = lastGroup && lastGroup.direction === msg.direction;
      if (lastGroup && sameDirection) lastGroup.messages.push(msg);
      else acc[date].push({ direction: msg.direction, messages: [msg] });
      return acc;
    }, {});
  }, [allMessages]);

  // 3) Auto-scroll SOLO cuando hay mensajes nuevos (SIN depender de isAtBottom en deps)
  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    const messageCount = allMessages.length;
    const hasNewMessage = messageCount > prevMessageCountRef.current;

    // NO hacer scroll si el usuario está scrolleando manualmente
    if (hasNewMessage && !isScrollingRef.current) {
      // Detectar si el último mensaje es propio (direction === 'sent')
      const lastMessage = allMessages[allMessages.length - 1];
      const isOwnMessage = lastMessage?.direction === 'sent';

      // Scroll si: 1) estabas abajo (via ref, no state), o 2) enviaste mensaje tú
      const threshold = 80;
      const wasAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
      const shouldScroll = wasAtBottom || isOwnMessage;

      if (shouldScroll) {
        requestAnimationFrame(() => {
          const node = chatContainerRef.current;
          if (!node) return;
          node.scrollTop = node.scrollHeight;
        });
      }
    }

    prevMessageCountRef.current = messageCount;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [allMessages]); // SOLO depende de allMessages

  // 4) Scroll handler - detecta posición y marca scroll manual
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    
    // Marcar que el usuario está scrolleando
    isScrollingRef.current = true;
    
    const threshold = 80;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    setIsAtBottom(atBottom);
    
    // Limpiar flag después de un timeout
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  }, []);

  const scrollToBottom = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    prevScrollHeightRef.current = el.scrollHeight;
    prevMessageCountRef.current = allMessages.length;
    setIsAtBottom(true);
  };

  const updateFabCenter = useCallback(() => {
    const composer = document.querySelector(".chat-composer-zone");
    const target = composer || chatContainerRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    setFabCenter(rect.left + rect.width / 2);
  }, []);

  useEffect(() => {
    updateFabCenter();
  }, [updateFabCenter, isMobileLayout, leftbarExpanded, rightPanelOpen, selectedContact]);

  useEffect(() => {
    window.addEventListener("resize", updateFabCenter);
    return () => window.removeEventListener("resize", updateFabCenter);
  }, [updateFabCenter]);

  return (
    <>
      <main
        className="chat-messages"
        ref={chatContainerRef}
        onScroll={handleScroll}
        aria-live="polite"
        aria-relevant="additions"
      >
      {/* No contact selected → previews */}
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

      </main>

      <ScrollToBottomButton
        visible={selectedContact && !isAtBottom}
        onClick={scrollToBottom}
        bottomOffset={isMobileLayout ? 84 : 96}
        centerX={fabCenter}
        zIndex={12}
      />
    </>
  );
};

export default React.memo(ChatMessages);
