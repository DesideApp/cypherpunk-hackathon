// src/features/messaging/ui/MessageBubble.jsx
import React from "react";
import { Check, CheckCheck, Lock } from "lucide-react";
import "./MessageBubble.css";

/** HH:MM (respeta locale) */
function fmtClock(ts) {
  const d = new Date(ts || Date.now());
  if (isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    .replace(/\u200E/g, "");
}

function fmtFull(ts) {
  const d = new Date(ts || Date.now());
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

/** Icono de estado (solo para mensajes propios) */
function MessageStatus({ msg }) {
  if (!msg || msg.sender !== "me") return null;
  const delivered = !!(msg.readAt || msg.deliveredAt || msg?.via === 'rtc' || msg?.via === 'rtc-fallback');
  const status = msg.status || (msg.readAt ? "read" : delivered ? "delivered" : "sent");

  if (status === "read") {
    return (
      <span className="message-status read" title={`Read • ${fmtClock(msg.readAt)}`}>
        <CheckCheck size={16} />
      </span>
    );
  }
  if (status === "delivered") {
    return (
      <span
        className="message-status delivered"
        title={`Delivered${msg?.deliveredAt ? ` • ${fmtClock(msg.deliveredAt)}` : ""}`}
      >
        <Check size={16} />
      </span>
    );
  }
  return (
    <span className="message-status sent" title="Sent" aria-label="Sent"><span className="dot" /></span>
  );
}

function Footer({ msg, overlay = false }) {
  const transport = (msg?.sender === 'me')
    ? ((msg?.via === 'rtc' || msg?.via === 'rtc-fallback') ? 'rtc' : (msg?.via === 'relay' ? 'relay' : null))
    : null;
  const inner = (
    <>
      <span className="message-timestamp" title={fmtFull(msg?.timestamp)}>{fmtClock(msg?.timestamp)}</span>
      {transport && (
        <span className={`transport-dot ${transport}`} title={transport === 'rtc' ? 'P2P' : 'Relay'} aria-label={transport === 'rtc' ? 'P2P' : 'Relay'} />
      )}
      <div className="message-flags">
        {(msg?.isEncrypted || msg?.media?.isEncrypted) && (
          <span className="message-flag" title="End-to-end encrypted">
            <Lock size={14} />
          </span>
        )}
        {msg?.isSigned && <span className="message-flag" title="Signed">✔️</span>}
        {msg?.isBackedUp && <span className="message-flag" title="Backed up">💾</span>}
        <MessageStatus msg={msg} />
      </div>
    </>
  );
  return overlay ? (
    <div className="message-footer overlay">{inner}</div>
  ) : (
    <div className="message-footer">{inner}</div>
  );
}

const MessageBubble = ({ msg = {}, isMe, position }) => {
  const hasMedia = !!msg?.media;
  const media = msg?.media || null;

  // Texto: si hay media y hay texto, lo mostramos como caption debajo de la media
  const hasText = typeof msg.text === "string" && msg.text.length > 0;
  const isTiny = !hasMedia && typeof msg.text === 'string' && msg.text.trim().length === 1;

  const bubbleClasses = [
    'message-bubble',
    isMe ? 'sent' : 'received',
    position,
    hasMedia ? (media.kind || 'file') : '',
  ].filter(Boolean).join(' ');

  const dataUri = (m) => `data:${m.mime || 'application/octet-stream'};base64,${m.base64}`;

  return (
    <div
      className={bubbleClasses}
      role="listitem"
      data-status={msg.status || (msg.deliveredAt ? "delivered" : "sent")}
    >
      <div className="message-content">
        {hasMedia ? (
          <div className="media-box">
            {media.kind === 'image' && (
              <img className="message-media image" src={dataUri(media)} alt="" />
            )}
            {media.kind === 'video' && (
              <video className="message-media video" src={dataUri(media)} controls preload="metadata" />
            )}
            {media.kind === 'audio' && (
              <audio className="message-media audio" src={dataUri(media)} controls preload="metadata" />
            )}
            <Footer msg={msg} overlay />
          </div>
        ) : (
          <>
            <span className={`message-text ${msg.isPlaceholder ? "placeholder" : ""} ${isTiny ? "tiny" : ""}`}>
              {hasText ? msg.text : (msg.isPlaceholder ? "🔒 Encrypted message" : " ")}
            </span>
            <Footer msg={msg} />
          </>
        )}

        {hasMedia && hasText && (
          <div className="message-caption">{msg.text}</div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MessageBubble);
