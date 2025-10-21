// src/features/messaging/ui/UnifiedList.jsx
import React, { useState, memo, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import useConversationsPreview from "@features/messaging/hooks/useConversationsPreview.js";
import { UiChip, UiSearchInput } from "@shared/ui";
import "./UnifiedList.css";

const formatPubkey = (key = "") =>
  key ? `${key.slice(0, 4)}...${key.slice(-4)}` : "";

const UnifiedList = ({
  conversations = [],
  contacts = [],
  previews = [],
  selectedWallet = null,
  selectedPubkey = null,
  onSelectConversation,
  onSelectContact,
  fixtures = [], // elementos visuales no clicables
  presence = {}, // mapa { wallet: boolean }
  mode = "desktop",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const { pubkey: selfWallet } = useAuthManager();
  const storePreviews = useConversationsPreview(selfWallet);

  const isOnline = useCallback((key) => !!(presence && presence[key]), [presence]);

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
        nickname: p.nickname || p.displayName || null,
        avatar: p.avatar || null,
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

  // ====== filtro por búsqueda + filtro activo ======
  const filtered = useMemo(() => {
    let list = mergedList;

    // 1. Aplicar filtro por tipo
    if (activeFilter === "unread") {
      list = list.filter((item) => (item.unreadCount || 0) > 0);
    } else if (activeFilter === "pending") {
      // TODO: implementar cuando tengamos tracking de requests pendientes
      list = list.filter((item) => item.hasPendingRequest === true);
    } else if (activeFilter === "contacts") {
      list = list.filter((item) => item.type === "contact");
    }
    // "all" no filtra nada

    // 2. Aplicar búsqueda de texto
    const term = (searchTerm || "").toLowerCase().trim();
    if (!term) return list;
    return list.filter((item) =>
      (item.nickname && item.nickname.toLowerCase().includes(term)) ||
      (item.pubkey && item.pubkey.toLowerCase().includes(term)) ||
      (item.lastMessageText && item.lastMessageText.toLowerCase().includes(term))
    );
  }, [mergedList, searchTerm, activeFilter]);

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

  return (
    <div className={`unified-list-container unified-list-container--${mode}`}>
      <div className="search-bar">
        <UiSearchInput
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchEnter}
          aria-label="Search conversations and contacts"
        />
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <UiChip
          selected={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
          className="ui-chip--filter"
        >
          All
        </UiChip>
        <UiChip
          selected={activeFilter === "unread"}
          onClick={() => setActiveFilter("unread")}
          className="ui-chip--filter"
        >
          Unread
        </UiChip>
        <UiChip
          selected={activeFilter === "pending"}
          onClick={() => setActiveFilter("pending")}
          className="ui-chip--filter"
        >
          Pending
        </UiChip>
        <UiChip
          selected={activeFilter === "contacts"}
          onClick={() => setActiveFilter("contacts")}
          className="ui-chip--filter"
        >
          Contacts
        </UiChip>
      </div>

      {displayList.length === 0 && <p className="no-results">No results.</p>}

      <ul className={`unified-list unified-list--${mode}`} role="listbox" aria-label="Conversations and contacts">
        {displayList.map((item) => {
          const isActive = selectedWallet === item.pubkey || selectedPubkey === item.pubkey;
          const isFixture = item.type === "fixture";
          const online = !isFixture && isOnline(item.pubkey);

          return (
            <li
              key={item.pubkey}
              className={`unified-item unified-item--${mode} ${item.type} ${isActive ? "active" : ""} ${isFixture ? "disabled" : ""}`}
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
              <div className="unified-avatar-circle" aria-hidden="true" data-letter={item.nickname?.[0] || item.pubkey?.[0] || '?'}>
                {item.avatar ? (
                  <img src={item.avatar} alt="" className="unified-avatar" />
                ) : (
                  <span className="avatar-placeholder">
                    {item.nickname?.[0] || item.pubkey?.[0] || "?"}
                  </span>
                )}
                {/* Indicador online en el avatar */}
                {online && <span className="avatar-online-indicator" />}
              </div>

              <div className="unified-info">
                <div className="unified-title-line">
                  <span className="unified-name">
                    {item.nickname || formatPubkey(item.pubkey)}
                  </span>

                  {item.type === "contact" && item.premium && (
                    <span className="badge premium">PREMIUM</span>
                  )}
                  {/* Badge UNKNOWN removido - pubkey truncada es suficiente */}
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
