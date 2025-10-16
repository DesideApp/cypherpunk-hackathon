// shared/ui/bubbles/ActionBubbleShell.jsx
import React from "react";
import { Lock } from "lucide-react";
import "./bubbles.css";

function fmtClock(ts) {
  const d = new Date(ts || Date.now());
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    .replace(/\u200E/g, "");
}

function TransportDot({ via }) {
  if (!via) return null;
  const kind = via === "rtc" || via === "relay" ? via : null;
  if (!kind) return null;
  const title = kind === "rtc" ? "Peer-to-peer" : "Relay";
  return <span className={`transport-dot ${kind}`} title={title} aria-label={title} />;
}

export default function ActionBubbleShell({
  children,
  timestamp = Date.now(),
  isMe = false,
  encrypted = false,
  transport = null,
}) {
  const tsIso = new Date(timestamp).toISOString();
  return (
    <>
      <div className="bubble-inner">
        <div className="action-body">
          {children}
        </div>
      </div>
      <div className="bubble-meta" aria-hidden="true">
        {isMe ? (
          <>
            <time className="bubble-time" dateTime={tsIso}>{fmtClock(timestamp)}</time>
            <span className="bubble-slot">
              {encrypted && (
                <span className="bubble-lock" title="End-to-end encrypted">
                  <Lock size={10} />
                </span>
              )}
            </span>
            <span className="bubble-slot">
              <TransportDot via={transport} />
            </span>
          </>
        ) : (
          <>
            <span className="bubble-slot">
              <TransportDot via={transport} />
            </span>
            <time className="bubble-time" dateTime={tsIso}>{fmtClock(timestamp)}</time>
          </>
        )}
      </div>
    </>
  );
}

