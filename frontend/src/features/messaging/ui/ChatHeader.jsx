// src/features/messaging/ui/ChatHeader.jsx
import React, { useMemo } from "react";
import { MoreVertical, Info } from "lucide-react";
import "./ChatHeader.css";

function normalizeContact(sel) {
  if (!sel) return { pubkey: null, nickname: null, avatar: null };
  if (typeof sel === "string") return { pubkey: sel, nickname: null, avatar: null };
  return {
    pubkey: sel.pubkey || sel.wallet || sel.id || null,
    nickname: sel.nickname || sel.name || null,
    avatar: sel.avatar || null,
  };
}

const ChatHeader = ({ selectedContact, peerOnline = false, isTyping = false, onOpenInfo }) => {
  const contact = useMemo(() => normalizeContact(selectedContact), [selectedContact]);

  const getDisplayName = () => {
    if (contact.nickname) return contact.nickname;
    if (contact.pubkey) return `${contact.pubkey.slice(0, 6)}...${contact.pubkey.slice(-4)}`;
    return "No contact selected";
  };

  const presenceLabel = contact.pubkey
    ? (isTyping ? "Typing…" : peerOnline ? "Online" : "Offline")
    : null;

  const presenceVariant = isTyping
    ? "variant-ok"
    : peerOnline
    ? "variant-ok-soft"
    : "variant-muted";

  return (
    <div className="chat-header" role="banner" aria-label="Chat header">
      <div className="chat-header-left">
        <div className="chat-avatar-circle" aria-hidden="true">
          {contact.avatar ? (
            <img src={contact.avatar} alt="" className="chat-avatar-image" />
          ) : (
            <span className="chat-avatar-text">
              {contact.nickname
                ? contact.nickname[0]
                : contact.pubkey
                ? contact.pubkey[0]
                : "?"}
            </span>
          )}
        </div>

        <div className="chat-info">
          <span
            className="chat-contact-name"
            title={contact.nickname || contact.pubkey || "No contact selected"}
          >
            {getDisplayName()}
          </span>

          {presenceLabel && (
            <span className="status-row">
              <span
                className={`status-pill ${presenceVariant}`}
                title={presenceLabel}
                aria-live="polite"
                aria-atomic="true"
              >
                {presenceLabel}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="chat-header-actions">
        <button className="chat-header-btn" aria-label="Contact info" type="button" onClick={onOpenInfo} title="Info">
          <Info size={18} />
        </button>
        <button className="chat-header-btn" aria-label="More options" type="button">
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
