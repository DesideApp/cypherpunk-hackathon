// src/features/messaging/ui/ChatHeader.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import useUserProfile from "@shared/hooks/useUserProfile.js";
import { MoreVertical, Search, Menu, ChevronLeft } from "lucide-react";
import SearchModal from "./SearchModal";
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

const ChatHeader = ({
  selectedContact,
  peerOnline = false,
  isTyping = false,
  messages = [],
  onSearchSelect,
  isCompactLayout = false,
  onOpenContacts,
  onOpenLeftbar,
}) => {
  const contact = useMemo(() => normalizeContact(selectedContact), [selectedContact]);
  const { profile } = useUserProfile(contact.pubkey, { ensure: true });
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const getDisplayName = () => {
    const name = profile?.nickname || contact.nickname;
    if (name) return name;
    if (contact.pubkey) return `${contact.pubkey.slice(0, 4)}...${contact.pubkey.slice(-4)}`;
    return "No contact selected";
  };

  const getTruncatedPubkey = () => {
    if (!contact.pubkey) return null;
    return `${contact.pubkey.slice(0, 4)}...${contact.pubkey.slice(-4)}`;
  };

  const handleCopyPubkey = () => {
    if (contact.pubkey) {
      navigator.clipboard.writeText(contact.pubkey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const presenceLabel = contact.pubkey
    ? (isTyping ? "Typing…" : peerOnline ? "Online" : "Offline")
    : null;

  const presenceVariant = isTyping
    ? "variant-ok"
    : peerOnline
    ? "variant-ok-soft"
    : "variant-muted";

  const showMobileActions = Boolean(isCompactLayout);
  const showContactsButton = typeof onOpenContacts === "function";
  const showLeftbarButton = typeof onOpenLeftbar === "function";
  return (
    <div className="chat-header" role="banner" aria-label="Chat header">
      <div className="chat-header-left">
        {showMobileActions && (
          <div className="chat-header-mobile-actions">
            {showLeftbarButton && (
              <button
                className="chat-header-btn"
                aria-label="Open navigation"
                type="button"
                onClick={onOpenLeftbar}
              >
                <Menu size={18} />
              </button>
            )}
            {showContactsButton && (
              <button
                className="chat-header-btn"
                aria-label="Back to contacts"
                type="button"
                onClick={onOpenContacts}
              >
                <ChevronLeft size={18} />
              </button>
            )}
          </div>
        )}

        <div className="chat-avatar-circle" aria-hidden="true">
          { (profile?.avatar || contact.avatar) ? (
            <img src={profile?.avatar || contact.avatar} alt="" className="chat-avatar-image" />
          ) : (
            <span className="chat-avatar-text">
              {(profile?.nickname || contact.nickname)
                ? (profile?.nickname || contact.nickname)[0]
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

          <div className="status-row">
            {presenceLabel && (
              <span
                className={`status-pill ${presenceVariant}`}
                title={presenceLabel}
                aria-live="polite"
                aria-atomic="true"
              >
                {presenceLabel}
              </span>
            )}
            
            {contact.pubkey && (
              <>
                <span className="status-separator">·</span>
                <span
                  className={`pubkey-pill ${copied ? 'copied' : ''}`}
                  title={copied ? "Copied!" : contact.pubkey}
                  onClick={handleCopyPubkey}
                >
                  {copied ? "Copied!" : getTruncatedPubkey()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="chat-header-actions">
        <button 
          className="chat-header-btn" 
          aria-label="Search messages" 
          type="button" 
          title="Search"
          onClick={() => setShowSearch(true)}
        >
          <Search size={18} strokeWidth={2.5} />
        </button>
        
        <div className="menu-wrapper" ref={menuRef}>
          <button 
            className="chat-header-btn" 
            aria-label="More options" 
            type="button"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical size={18} />
          </button>
          
          {showMenu && (
            <div className="chat-menu">
              <button className="menu-item" onClick={handleCopyPubkey}>
                📋 Copy address
              </button>
              <button className="menu-item" onClick={() => setShowMenu(false)}>
                🔍 Search messages
              </button>
              <button className="menu-item" onClick={() => setShowMenu(false)}>
                🔕 Mute
              </button>
              <button className="menu-item danger" onClick={() => setShowMenu(false)}>
                🗑️ Delete conversation
              </button>
            </div>
          )}
        </div>

        {/* Panel de búsqueda - posicionado absolutamente */}
        {showSearch && (
          <SearchModal
            messages={messages}
            onClose={() => setShowSearch(false)}
            onSelectMessage={(msg) => {
              if (onSearchSelect) {
                onSearchSelect(msg);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
