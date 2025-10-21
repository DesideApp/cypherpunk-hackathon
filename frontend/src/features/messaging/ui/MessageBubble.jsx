// src/features/messaging/ui/MessageBubble.jsx
import React from "react";
import { Lock } from "lucide-react";
import TextBubble from "../../../shared/ui/bubbles/TextBubble.jsx";
import AgreementCard from "./AgreementCard.jsx";
import PaymentRequestCard from "./PaymentRequestCard.jsx";
import ActionBubbleShell from "../../../shared/ui/bubbles/ActionBubbleShell.jsx";
import BlinkActionCard from "./BlinkActionCard.jsx";
import "./MessageBubble.css";

function resolveTransport(via) {
  if (!via) return null;
  if (via === "rtc" || via === "relay") return via;
  if (via === "rtc-fallback") return "rtc";
  return null;
}

function ViaDot({ via }) {
  const kind = resolveTransport(via);
  if (!kind) return null;
  const title = kind === "rtc" ? "Peer-to-peer" : "Relay";
  return (
    <span
      className={`transport-dot ${kind}`}
      title={title}
      aria-label={title}
    />
  );
}

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

function Footer({ msg, overlay = false }) {
  return (
    <div className={`message-footer${overlay ? " overlay" : ""}`}>
      <div className="meta-left">
        <ViaDot via={msg?.via} />
        <span className="message-timestamp" title={fmtFull(msg?.timestamp)}>
          {fmtClock(msg?.timestamp)}
        </span>
      </div>
      <div className="message-flags">
        {(msg?.isEncrypted || msg?.media?.isEncrypted) && (
          <span className="message-flag" title="End-to-end encrypted">
            <Lock size={14} />
          </span>
        )}
        {msg?.isSigned && <span className="message-flag" title="Signed">✔️</span>}
        {msg?.isBackedUp && (
          <span className="message-flag" title="Backed up">💾</span>
        )}
      </div>
    </div>
  );
}

const MessageBubble = ({ msg = {}, isMe, position }) => {
  const hasMedia = !!msg?.media;
  const media = msg?.media || null;
  const hasText = typeof msg.text === "string" && msg.text.length > 0;
  const isTiny = !hasMedia && typeof msg.text === "string" && msg.text.trim().length === 1;

  const bubbleClasses = [
    "message-bubble",
    isMe ? "sent" : "received",
    position,
    hasMedia ? media.kind || "file" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const dataUri = (m) => `data:${m.mime || "application/octet-stream"};base64,${m.base64}`;

  if (msg?.kind === "agreement" && msg?.agreement) {
    const bubbleClasses = [
      "message-bubble",
      "agreement-wrapper",
      isMe ? "sent" : "received",
      position,
    ].join(" ");
    return (
      <div className={bubbleClasses} role="listitem">
        <AgreementCard msg={msg} />
      </div>
    );
  }

  if (msg?.kind === "payment-request" && msg?.paymentRequest) {
    const bubbleClasses = [
      "message-bubble",
      "payment-request-wrapper",
      isMe ? "sent" : "received",
      position,
    ].join(" ");
    return (
      <div
        className={bubbleClasses}
        role="listitem"
        data-status={msg.status || (msg.deliveredAt ? "delivered" : "sent")}
        data-via={resolveTransport(msg?.via) || ""}
      >
        <div className="message-content message-content--action">
          <ActionBubbleShell
            timestamp={msg?.timestamp || msg?.createdAt || Date.now()}
            isMe={isMe}
            encrypted={!!msg?.isEncrypted}
            transport={msg?.via || null}
          >
            <PaymentRequestCard msg={msg} />
          </ActionBubbleShell>
        </div>
      </div>
    );
  }

  if (msg?.kind === "blink-action" && msg?.blinkAction) {
    const bubbleClasses = [
      "message-bubble",
      "blink-action-wrapper",
      isMe ? "sent" : "received",
      position,
    ].join(" ");
    return (
      <div className={bubbleClasses} role="listitem">
        <BlinkActionCard msg={msg} />
      </div>
    );
  }

  const ts = msg?.timestamp || Date.now();
  const contentClassNames = ["message-content"];

  if (hasMedia) {
    contentClassNames.push("message-content--media");
  } else {
    contentClassNames.push("message-content--text");
  }

  return (
    <div
      className={bubbleClasses}
      role="listitem"
      data-status={msg.status || (msg.deliveredAt ? "delivered" : "sent")}
      data-via={resolveTransport(msg?.via) || ""}
    >
      <div className={contentClassNames.join(" ")}>
        {hasMedia ? (
          <div className="media-box">
            {media.kind === "image" && (
              <img className="message-media image" src={dataUri(media)} alt="" />
            )}
            {media.kind === "video" && (
              <video className="message-media video" src={dataUri(media)} controls preload="metadata" />
            )}
            {media.kind === "audio" && (
              <audio className="message-media audio" src={dataUri(media)} controls preload="metadata" />
            )}
            <Footer msg={msg} overlay />
          </div>
        ) : (
          <TextBubble
            text={hasText ? msg.text : ""}
            timestamp={ts}
            isMe={isMe}
            encrypted={!!(msg?.isEncrypted || msg?.media?.isEncrypted)}
            transport={msg?.via || null}
            isTiny={isTiny}
            isPlaceholder={!!msg?.isPlaceholder}
          />
        )}
        {hasMedia && hasText && <div className="message-caption">{msg.text}</div>}
      </div>
    </div>
  );
};

export default React.memo(MessageBubble);
