// src/features/messaging/ui/UnifiedList.jsx
import React, { useState, memo, useMemo, useCallback, useEffect, useRef } from "react";
import { FaSearch } from "react-icons/fa";
import { useSocket } from "@shared/socket/index.jsx";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import useConversationsPreview from "@features/messaging/hooks/useConversationsPreview.js";
import "./UnifiedList.css";

const formatPubkey = (key = "") =>
  key ? `${key.slice(0, 6)}...${key.slice(-4)}` : "";

const UnifiedList = ({
  conversations = [],
  contacts = [],
  previews = [],
  selectedWallet = null,
  selectedPubkey = null,
  onSelectConversation,
  onSelectContact,
  fixtures = [], // elementos visuales no clicables
  presence = {}, // opcional: mapa inicial { wallet: boolean }
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { onPresence } = useSocket();
  const { pubkey: selfWallet } = useAuthManager();
  const storePreviews = useConversationsPreview(selfWallet);

  // ====== presencia (en tiempo real) ======
  const presenceRef = useRef(new Map(Object.entries(presence || {})));
  const [, force] = useState(0);

  useEffect(() => {
    const off = onPresence?.(({ wallet, online }) => {
      if (!wallet) return;
      presenceRef.current.set(wallet, !!online);
      force(n => (n + 1) % 1000);
    });
    return () => { try { off?.(); } catch {} };
  }, [onPresence]);

  const isOnline = useCallback((key) => {
    if (!key) return false;
    return !!presenceRef.current.get(key);
  }, []);

  // ====== unificación conversaciones + contactos + previews ======
  const mergedList = useMemo(() => {
    const map = new Map();

    for (const conv of conversations) {
      if (!conv?.pubkey) continue;
      map.set(conv.pubkey, { ...conv, type: "conversation" });
    }
    for (const c of contacts) {
      const key = c?.wallet;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { ...c, pubkey: key, type: "contact" });
      } else {
        const prev = map.get(key);
        map.set(key, {
          ...prev,
          nickname: prev.nickname ?? c.nickname ?? null,
          avatar: prev.avatar ?? c.avatar ?? null,
          type: prev.type || "conversation",
        });
      }
    }
    // Previews desde backup/local
    for (const p of previews) {
      const key = p?.chatId;
      if (!key || map.has(key)) continue;
      map.set(key, {
        pubkey: key,
        lastMessageText: p.lastMessageText,
        lastMessageTimestamp: p.lastMessageTimestamp,
        type: "preview",
      });
    }

    // Previews derivados del store (últimos mensajes reales)
    for (const sp of storePreviews) {
      const key = sp?.chatId;
      if (!key) continue;
      if (map.has(key)) {
        const prev = map.get(key);
        map.set(key, {
          ...prev,
          lastMessageText: sp.lastMessageText ?? prev.lastMessageText,
          lastMessageTimestamp: sp.lastMessageTimestamp ?? prev.lastMessageTimestamp,
          typing: sp.typing || prev.typing,
        });
      } else {
        map.set(key, {
          pubkey: key,
          lastMessageText: sp.lastMessageText,
          lastMessageTimestamp: sp.lastMessageTimestamp,
          typing: sp.typing,
          type: "preview",
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const t1 = a.timestamp || a.lastMessageTimestamp || 0;
      const t2 = b.timestamp || b.lastMessageTimestamp || 0;
      return t2 - t1;
    });
  }, [conversations, contacts, previews, storePreviews]);

  // ====== fixtures normalizados al final si no hay búsqueda ======
  const normalizedFixtures = useMemo(
    () => (fixtures || []).map((f, i) => ({
      ...f,
      type: "fixture",
      pubkey: f.pubkey || `FIXTURE_${i}`,
    })),
    [fixtures]
  );

  // ====== filtro por búsqueda ======
  const filtered = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();
    if (!term) return mergedList;
    return mergedList.filter((item) =>
      (item.nickname && item.nickname.toLowerCase().includes(term)) ||
      (item.pubkey && item.pubkey.toLowerCase().includes(term)) ||
      (item.lastMessageText && item.lastMessageText.toLowerCase().includes(term))
    );
  }, [mergedList, searchTerm]);

  const displayList = useMemo(() => {
    if (searchTerm.trim()) return filtered;
    return [...filtered, ...normalizedFixtures];
  }, [filtered, normalizedFixtures, searchTerm]);

  // ====== acciones ======
  const handleSearchEnter = useCallback((e) => {
    if (e.key !== "Enter") return;
    const firstReal = displayList.find((it) => it.type !== "fixture");
    if (!firstReal) return;
    e.preventDefault();
    // ✅ No gate: permitimos abrir la vista
    if (firstReal.type === "conversation") onSelectConversation?.(firstReal.pubkey);
    else onSelectContact?.(firstReal.pubkey);
  }, [displayList, onSelectConversation, onSelectContact]);

  const selectItem = useCallback((item) => {
    if (!item || item.type === "fixture") return;
    // ✅ No gate: permitimos abrir la vista
    if (item.type === "conversation") onSelectConversation?.(item.pubkey);
    else onSelectContact?.(item.pubkey);
  }, [onSelectConversation, onSelectContact]);

  // ====== estilos inline para el punto de presencia ======
  const dot = (online) => ({
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 8,
    flex: "0 0 auto",
    background: online ? "var(--green-500, #10b981)" : "var(--gray-400, #9ca3af)",
    boxShadow: online ? "0 0 0 2px rgba(16,185,129,.25)" : "none",
  });

  return (
    <div className="unified-list-container">
      <div className="search-bar">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchEnter}
          aria-label="Search conversations and contacts"
        />
      </div>

      {displayList.length === 0 && <p className="no-results">No results.</p>}

      <ul className="unified-list" role="listbox" aria-label="Conversations and contacts">
        {displayList.map((item) => {
          const isActive = selectedWallet === item.pubkey || selectedPubkey === item.pubkey;
          const isFixture = item.type === "fixture";
          const online = !isFixture && isOnline(item.pubkey);

          return (
            <li
              key={item.pubkey}
              className={`unified-item ${item.type} ${isActive ? "active" : ""} ${isFixture ? "disabled" : ""}`}
              role="option"
              aria-selected={isActive}
              aria-disabled={isFixture}
              tabIndex={isFixture ? -1 : 0}
              onClick={() => selectItem(item)}
              onKeyDown={(e) => {
                if (isFixture) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectItem(item);
                }
              }}
              title={item.nickname || item.pubkey}
            >
              {/* Punto presencia */}
              <span aria-hidden="true" style={dot(online)} />

              <div className="unified-avatar-circle" aria-hidden="true">
                {item.avatar ? (
                  <img src={item.avatar} alt="" className="unified-avatar" />
                ) : (
                  <span className="avatar-placeholder">
                    {item.nickname?.[0] || item.pubkey?.[0] || "?"}
                  </span>
                )}
              </div>

              <div className="unified-info">
                <div className="unified-title-line">
                  <span className="unified-name">
                    {item.nickname || formatPubkey(item.pubkey)}
                  </span>

                  {item.type === "contact" && item.premium && (
                    <span className="badge premium">PREMIUM</span>
                  )}
                  {item.type === "preview" && (
                    <span className="badge unknown">UNKNOWN</span>
                  )}
                  {isFixture && <span className="badge demo">DEMO</span>}
                </div>

                <span className={`unified-preview ${item.typing ? 'typing' : ''}`}>
                  {item.typing ? 'Typing…' : (item.lastMessageText ? item.lastMessageText.slice(0, 60) : '')}
                </span>
              </div>

              <div className="unified-meta">
                {(item.timestamp || item.lastMessageTimestamp) && (
                  <span className="timestamp">
                    {new Date(item.timestamp || item.lastMessageTimestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {item.unreadCount > 0 && (
                  <span className="unified-unread-badge">{item.unreadCount}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default memo(UnifiedList);
