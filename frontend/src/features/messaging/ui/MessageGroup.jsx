// src/features/messaging/ui/MessageGroup.jsx
import React from "react";
import MessageBubble from "./MessageBubble";
import "./MessageGroup.css";

/**
 * Agrupa mensajes contiguos del mismo remitente y calcula la posición
 * dentro del grupo para redondeos (first|middle|last).
 */
const MessageGroup = ({ date, messages }) => {
  if (!messages || messages.length === 0) return null;

  const isSentGroup = messages[0]?.direction === "sent";

  return (
    <section
      className={`message-group ${isSentGroup ? "sent" : "received"}`}
      role="list"
      aria-label={isSentGroup ? "Messages you sent" : "Messages received"}
    >
      {date && (
        <div className="date-divider" aria-label={date}>
          {date}
        </div>
      )}

      {messages.map((msg, idx) => {
        const prev = messages[idx - 1];
        const next = messages[idx + 1];
        const samePrev = prev && prev.direction === msg.direction;
        const sameNext = next && next.direction === msg.direction;
        const position = !samePrev && !sameNext
          ? "first last"
          : !samePrev
            ? "first"
            : !sameNext
              ? "last"
              : "middle";

        const key =
          msg.id ??
          msg.clientMsgId ??
          (msg.timestamp
            ? `${msg.direction || "x"}-${msg.timestamp}-${idx}`
            : `${msg.direction || "x"}-idx-${idx}`);

        return (
          <MessageBubble
            key={key}
            msg={msg}
            direction={msg.direction}
            position={position}
          />
        );
      })}
    </section>
  );
};

export default React.memo(MessageGroup);
