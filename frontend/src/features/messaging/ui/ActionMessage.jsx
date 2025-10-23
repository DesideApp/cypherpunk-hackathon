import React from "react";
import ActionBubbleShell from "@shared/ui/bubbles/ActionBubbleShell.jsx";
import PaymentRequestCard from "./PaymentRequestCard.jsx";
import BlinkActionCard from "./BlinkActionCard.jsx";
import AgreementCard from "./AgreementCard.jsx";
import "./MessageBubble.css";

function resolveTransport(via) {
  if (!via) return null;
  if (via === "rtc" || via === "relay") return via;
  if (via === "rtc-fallback") return "rtc";
  return null;
}

function renderActionCard(kind, msg, direction) {
  switch (kind) {
    case "payment-request":
      return <PaymentRequestCard msg={msg} direction={direction} />;
    case "blink-action":
      return <BlinkActionCard msg={msg} direction={direction} />;
    case "agreement":
      return <AgreementCard msg={msg} direction={direction} />;
    default:
      return null;
  }
}

export default function ActionMessage({ msg, direction = "received", position }) {
  const isSent = direction === "sent";
  const timestamp = msg?.timestamp || msg?.createdAt || Date.now();
  const bubbleClasses = [
    "message-bubble",
    `${msg?.kind || "action"}-wrapper`,
    isSent ? "sent" : "received",
    position,
  ]
    .filter(Boolean)
    .join(" ");

  const actionCard = renderActionCard(msg?.kind, msg, direction);
  if (!actionCard) {
    return null;
  }

  const transport = resolveTransport(msg?.via);

  return (
    <div
      className={bubbleClasses}
      role="listitem"
      data-status={msg.status || (msg.deliveredAt ? "delivered" : "sent")}
      data-via={transport || ""}
    >
      <div className="message-content message-content--action bubble-action">
        <ActionBubbleShell
          timestamp={timestamp}
          isMe={isSent}
          encrypted={!!msg?.isEncrypted}
          transport={transport}
        >
          {actionCard}
        </ActionBubbleShell>
      </div>
    </div>
  );
}
