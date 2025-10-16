import React, { useState, memo, useEffect, useCallback, useRef, useMemo } from "react";
import { UserPlus, Bell } from "lucide-react";
import useContactManager from "@features/contacts/hooks/useContactManager";
import useConversationManager from "@features/contacts/hooks/useConversationManager";
import NotificationPanel from "@features/messaging/ui/NotificationPanel";
import AddContactForm from "@features/messaging/ui/AddContactForm";
import UnifiedList from "@features/messaging/ui/UnifiedList";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { loadContactsCache } from "@features/contacts/services/contactsCache.js";
import { DEMO_PREVIEWS, DEMO_CONTACTS_STATE } from "@features/contacts/services/demoContacts.js";
import { IS_DEMO } from "@shared/config/env.js";
import { loadRecent } from "@features/messaging/utils/recentConversations.js";
import { wipeModeData } from "@shared/utils/cleanup.js";
import { subscribe, getState } from "@features/messaging/store/messagesStore.js";
import "./LeftPanel.css";

const LeftPanel = ({ onSelectContact }) => {
  const {
    confirmedContacts = [],
    receivedRequests = [],
    handleAddContact,
    handleAcceptRequest,
    handleRejectRequest,
    loadContacts,
  } = useContactManager();

  const { conversations = [], loading: conversationsLoading } = useConversationManager();

  // 🔐 Estado de auth (NO llamamos ensureReady en bucles de efecto)
  const { isAuthenticated, ensureReadyOnce } = useAuthManager();

  const localPreviews = useMemo(() => {
    if (!IS_DEMO || isAuthenticated) return [];
    const cached = loadContactsCache();
    const source = cached?.confirmed?.length
      ? cached.confirmed
      : DEMO_CONTACTS_STATE.confirmed;
    if (!Array.isArray(source) || source.length === 0) return DEMO_PREVIEWS;
    return source.map((entry, idx) => ({
      chatId: entry.wallet,
      displayName: entry.nickname ?? entry.wallet,
      lastMessageText: DEMO_PREVIEWS[idx]?.lastMessageText ?? "Start a secure chat",
      lastMessageTimestamp:
        DEMO_PREVIEWS[idx]?.lastMessageTimestamp ?? Date.now() - idx * 45_000,
    }));
  }, [isAuthenticated]);

  const [recentPreviews, setRecentPreviews] = useState(() => loadRecent());

  const combinedPreviews = useMemo(() => {
    const map = new Map();
    recentPreviews.forEach((item) => {
      if (item?.chatId) {
        map.set(item.chatId, {
          chatId: item.chatId,
          displayName: item.displayName || null,
          nickname: item.displayName || null,
          lastMessageText: item.lastMessageText || "",
          lastMessageTimestamp: item.lastMessageTimestamp || Date.now(),
        });
      }
    });
    localPreviews.forEach((item) => {
      if (item?.chatId && !map.has(item.chatId)) {
        map.set(item.chatId, {
          ...item,
          nickname: item.displayName || null,
        });
      }
    });
    return Array.from(map.values());
  }, [recentPreviews, localPreviews]);

  const [selectedContactWallet, setSelectedContactWallet] = useState(null);
  const [selectedConversationPubkey, setSelectedConversationPubkey] = useState(null);
  const [activeSocial, setActiveSocial] = useState(null); // 'add' | 'notis' | null
  const [isExpanded, setIsExpanded] = useState(false);

  const isLoading = !!conversationsLoading;

  // 🟢 Presencia (socket)
  const [presenceMap, setPresenceMap] = useState(() => {
    try { return getState()?.presence || {}; }
    catch { return {}; }
  });

  useEffect(() => {
    const off = subscribe((snap) => {
      try {
        setPresenceMap(snap?.presence || {});
        setRecentPreviews(loadRecent());
      } catch {}
    });
    return () => { try { off?.(); } catch {} };
  }, []);

  // Fixtures visuales (no clicables)
  // Demostraciones eliminadas según feedback: lista más limpia
  const DEMO_FIXTURES = useMemo(() => [], []);

  // ✅ Carga inicial: sólo cuando hay sesión (una vez)
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) {
      loadedOnceRef.current = false;
      return;
    }
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    (async () => { try { await loadContacts(); } catch {} })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Helper: descriptor para ChatHeader/ChatWindow
  const buildContactDescriptor = useCallback((key) => {
    if (!key) return { pubkey: null, nickname: null, avatar: null };
    const fromContacts = confirmedContacts.find(c => c.wallet === key);
    const fromConvs    = conversations.find(c => c.pubkey === key);
    const fromPrev     = combinedPreviews.find(p => p.chatId === key);
    return {
      pubkey: key,
      nickname: fromConvs?.nickname ?? fromContacts?.nickname ?? fromPrev?.displayName ?? null,
      avatar:   fromConvs?.avatar   ?? fromContacts?.avatar   ?? null,
    };
  }, [confirmedContacts, conversations, combinedPreviews]);

  const handleConversationSelect = useCallback(async (pubkey) => {
    const ready = await ensureReadyOnce();
    if (!ready) return;
    setSelectedConversationPubkey(pubkey);
    setSelectedContactWallet(null);
    onSelectContact?.(buildContactDescriptor(pubkey));
  }, [ensureReadyOnce, buildContactDescriptor, onSelectContact]);

  const handleContactSelect = useCallback(async (wallet) => {
    const ready = await ensureReadyOnce();
    if (!ready) return;
    setSelectedContactWallet(wallet);
    setSelectedConversationPubkey(null);
    onSelectContact?.(buildContactDescriptor(wallet));
  }, [ensureReadyOnce, buildContactDescriptor, onSelectContact]);

  const toggleSocial = useCallback(async (panel) => {
    const isOpening = panel && panel !== activeSocial;
    if (isOpening) {
      const ready = await ensureReadyOnce();
      if (!ready) return;
    }

    setActiveSocial((prev) => {
      if (prev === panel || panel === null) {
        setIsExpanded(false);
        return null;
      }
      setIsExpanded(true);
      return panel;
    });

    if (panel) {
      try { await loadContacts(); } catch {}
    }
  }, [activeSocial, ensureReadyOnce, loadContacts]);

  const handleDemoReset = useCallback((event) => {
    if (event) event.stopPropagation();
    wipeModeData();
  }, []);

  return (
    <div className="left-panel">
      {/* Header */}
      <div
        className={`social-header ${isExpanded ? "expanded" : ""}`}
        onClick={(e) => {
          if (!e.target.closest(".social-button")) {
            setActiveSocial(null);
            setIsExpanded(false);
          }
        }}
      >
        <h2 className="left-panel-title">Chat</h2>

        <div className="social-header-buttons">
          <button
            className={`social-button ${activeSocial === "add" ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); toggleSocial("add"); }}
            aria-label="Add Contact"
            type="button"
          >
            <UserPlus size={20} />
          </button>

          <button
            className={`social-button ${activeSocial === "notis" ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); toggleSocial("notis"); }}
            aria-label="Notifications"
            type="button"
          >
            <div className="icon-wrapper">
              <Bell size={20} />
              {(receivedRequests?.length || 0) > 0 && (
                <span className="badge">{receivedRequests.length}</span>
              )}
            </div>
          </button>

          {IS_DEMO && (
            <button
              className="social-button"
              onClick={handleDemoReset}
              aria-label="Reset Demo Data"
              type="button"
              title="Reset demo data"
            >
              ⟲
            </button>
          )}
        </div>
      </div>

      {/* Wallet balance widget eliminado según feedback */}

      {/* Panel social */}
      <div className={`left-panel-social ${isExpanded ? "expanded" : "collapsed"}`}>
        <div className="social-content-wrapper">
          <div className={`social-tab ${activeSocial === "add" ? "visible" : ""}`}>
            <AddContactForm
              onContactAdded={handleAddContact}
              resetTrigger={activeSocial}
              refreshContacts={loadContacts}
            />
          </div>

          <div className={`social-tab ${activeSocial === "notis" ? "visible" : ""}`}>
            <NotificationPanel
              receivedRequests={receivedRequests}
              onAcceptRequest={handleAcceptRequest}
              onRejectRequest={handleRejectRequest}
            />
          </div>
        </div>
      </div>

      {/* Lista principal */}
      <div className={`left-panel-main ${isExpanded ? "with-social-expanded" : "with-social-collapsed"}`}>
        {isLoading && <p className="left-panel-loading">Loading...</p>}

        {!isLoading && (
          <UnifiedList
            conversations={conversations}
            contacts={confirmedContacts}
            previews={combinedPreviews}
            selectedWallet={selectedContactWallet}
            selectedPubkey={selectedConversationPubkey}
            onSelectConversation={(pubkey) => { void handleConversationSelect(pubkey); }}
            onSelectContact={(wallet) => { void handleContactSelect(wallet); }}
            fixtures={DEMO_FIXTURES}
            presence={presenceMap}
          />
        )}
      </div>
    </div>
  );
};

export default memo(LeftPanel);
