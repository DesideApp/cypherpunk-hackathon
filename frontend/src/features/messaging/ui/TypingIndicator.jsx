// src/features/messaging/ui/TypingIndicator.jsx
import React from "react";

export default function TypingIndicator({ isTyping, whoLabel = "The other participant" }) {
  if (!isTyping) return null;
  return (
    <div
      style={{
        fontSize: 12,
        opacity: 0.7,
        margin: "6px 8px",
        userSelect: "none",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {whoLabel} is typing...
    </div>
  );
}
