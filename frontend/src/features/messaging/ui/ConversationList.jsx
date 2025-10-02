// src/features/messaging/ui/ConversationList.jsx
import React, { useState, memo, useEffect, useMemo, useCallback } from "react";
import { FaSearch } from "react-icons/fa";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import useConversationManager from "@features/contacts/hooks/useConversationManager";
import useConversationsPreview from "@features/messaging/hooks/useConversationsPreview.js";
import { subscribe, getState } from "@features/messaging/store/messagesStore.js";
import "./ConversationList.css";

const formatPubkey = (pubkey) => {
  if (!pubkey) return "";
  return `${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`;
};

// Punto de presencia: inline para no tocar CSS global
const presenceDotStyle = (online) => ({
  display: "inline-block",
  width: 8,
  height: 8,
  borderRadius: "50%",
  marginRight: 6,
  background: online ? "#10b981" : "#9ca3af", // verde / gris
  flex: "0 0 8px",
  alignSelf: "center",
});

const ConversationList = ({ onConversationSelected, selectedPubkey = null }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const {
    conversations = [],
    loading,
    error,
    refreshConversations,
  } = useConversationManager();

  // Sólo usamos isAuthenticated para refrescar cuando tenga sentido
  const { isAuthenticated, pubkey: selfWallet } = useAuthManager();
  const storePreviews = useConversationsPreview(selfWallet);

  // Presencia en tiempo real
  const [onlineMap, setOnlineMap] = useState(() => {
    try { return getState()?.presence || {}; }
    catch { return {}; }
  });

  useEffect(() => {
    const off = subscribe((snap) => {
      try { setOnlineMap(snap?.presence || {}); }
      catch {}
    });
    return () => { try { off?.(); } catch {} };
  }, []);

  // Refrescar conversaciones cuando hay sesión (sin gatear con ensureReady aquí)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) return;
      try {
        await refreshConversations?.();
      } catch {}
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, refreshConversations]);

  // Fusionar info con previews del store (último mensaje/hora/typing)
  const enriched = useMemo(() => {
    const map = new Map();
    for (const c of conversations) {
      map.set(c.pubkey, { ...c });
    }
    for (const p of storePreviews) {
      const key = p.chatId;
      const prev = map.get(key) || { pubkey: key };
      map.set(key, {
        ...prev,
        lastMessage: p.lastMessageText ?? prev.lastMessage ?? '',
        timestamp: p.lastMessageTimestamp ?? prev.timestamp ?? null,
        typing: p.typing || prev.typing || false,
      });
    }
    return Array.from(map.values());
  }, [conversations, storePreviews]);

  // Filtro por nickname o pubkey
  const filteredConversations = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();
    if (!term) return enriched;
    return enriched.filter((conv) =>
      (conv.nickname && conv.nickname.toLowerCase().includes(term)) ||
      conv.pubkey?.toLowerCase().includes(term)
    );
  }, [enriched, searchTerm]);

  // Orden por timestamp desc
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort(
      (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
    );
  }, [filteredConversations]);

  const selectConversation = useCallback((pubkey) => {
    if (!pubkey) return;
    // ❌ No gateamos aquí: abrir la conversación debe funcionar aun sin auth.
    onConversationSelected?.(pubkey);
  }, [onConversationSelected]);

  return (
    <div className="conversation-list-container">
      <div className="search-bar">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search conversations"
        />
        {refreshConversations && (
          <button
            onClick={refreshConversations}
            className="refresh-button"
            aria-label="Refresh conversations"
            title="Refresh"
          >
            🔄
          </button>
        )}
      </div>

      {loading && <p className="loading-text">Loading conversations...</p>}
      {error && <p className="error-text">❌ {error}</p>}

      {!loading && !error && sortedConversations.length > 0 && (
        <ul className="conversation-list" role="listbox" aria-label="Conversations">
          {sortedConversations.map((conv) => {
            const isUnread = conv.unreadCount > 0;
            const isActive = selectedPubkey === conv.pubkey;
            const isOnline = !!onlineMap[conv.pubkey];

            return (
              <li
                key={conv.pubkey}
                className={`conversation-item ${isActive ? "active" : ""} ${isUnread ? "unread" : ""}`}
                onClick={() => selectConversation(conv.pubkey)}
                role="option"
                aria-selected={isActive}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectConversation(conv.pubkey);
                  }
                }}
                title={conv.nickname || conv.pubkey}
              >
                {/* Presencia + Avatar */}
                <span
                  style={presenceDotStyle(isOnline)}
                  aria-label={isOnline ? "Online" : "Offline"}
                  title={isOnline ? "Online" : "Offline"}
                />
                {conv.avatar && (
                  <img
                    src={conv.avatar}
                    alt=""
                    className="conversation-avatar"
                    aria-hidden="true"
                  />
                )}

                <div className="conversation-info">
                  <span className={`conversation-name ${isUnread ? "bold" : ""}`}>
                    {conv.nickname
                      ? `${conv.nickname} (${formatPubkey(conv.pubkey)})`
                      : formatPubkey(conv.pubkey)}
                  </span>

                  <span className={`conversation-last-message ${isUnread ? "bold" : ""}`}>
                    {conv.typing ? 'Typing…' : (conv.lastMessage?.slice(0, 50) || 'No messages yet.')}
                  </span>
                </div>

                <span className="conversation-time">
                  {conv.timestamp
                    ? new Date(conv.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>

                {isUnread && (
                  <span className="conversation-unread-badge">
                    {conv.unreadCount}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && sortedConversations.length === 0 && (
        <p className="no-conversations">No conversations found.</p>
      )}
    </div>
  );
};

export default memo(ConversationList);
