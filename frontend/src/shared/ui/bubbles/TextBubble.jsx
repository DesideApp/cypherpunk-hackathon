// shared/ui/bubbles/TextBubble.jsx
import React from "react";
import "./bubbles.css";
import { Lock } from "lucide-react";
import { processTextWithPreviews } from "../../../features/messaging/ui/previews/index.js";
import { PreviewList } from "../../../features/messaging/ui/previews/PreviewCard.jsx";

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

export default function TextBubble({
  text = "",
  timestamp = Date.now(),
  isMe = false,
  encrypted = false,
  transport = null,
  isTiny = false,
  isPlaceholder = false,
}) {
  const tsIso = new Date(timestamp).toISOString();
  
  // Procesar texto con sistema modular de previews
  const [processedText, setProcessedText] = React.useState(text);
  const [previews, setPreviews] = React.useState([]);
  const [hasPreviews, setHasPreviews] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const processText = async () => {
      setLoading(true);
      try {
        const result = await processTextWithPreviews(text, isMe);
        setProcessedText(result.processedText);
        setPreviews(result.previews);
        setHasPreviews(result.hasPreviews);
      } catch (error) {
        console.error('Error processing text with previews:', error);
        setProcessedText(text);
        setPreviews([]);
        setHasPreviews(false);
      } finally {
        setLoading(false);
      }
    };

    processText();
  }, [text, isMe]);

  return (
    <>
      <div className="bubble-inner">
        {processedText && (
          <span
            className={`bubble-text message-text ${isPlaceholder ? "placeholder" : ""} ${
              isTiny ? "tiny" : ""
            }`}
          >
            {processedText}
          </span>
        )}
        
        {/* Mostrar previews detectados */}
        {hasPreviews && (
          <div className="bubble-previews">
            <PreviewList previews={previews} isMe={isMe} />
          </div>
        )}
        
        {/* Mostrar placeholder si no hay texto ni previews */}
        {!processedText && !hasPreviews && (
          <span
            className={`bubble-text message-text ${isPlaceholder ? "placeholder" : ""} ${
              isTiny ? "tiny" : ""
            }`}
          >
            {isPlaceholder ? "🔒 Encrypted message" : " "}
          </span>
        )}
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
