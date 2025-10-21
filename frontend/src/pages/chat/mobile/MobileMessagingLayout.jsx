import React, { useState, useCallback, useEffect } from "react";

import MobileConversationList from "./MobileConversationList.jsx";
import MobileChatScreen from "./MobileChatScreen.jsx";

import "../Chat.css";

const VIEW_LIST = "list";
const VIEW_CHAT = "chat";

export default function MobileMessagingLayout() {
  const [view, setView] = useState(VIEW_LIST);
  const [selectedContact, setSelectedContact] = useState(null);

  const handleSelectContact = useCallback((contact) => {
    setSelectedContact(contact);
    setView(VIEW_CHAT);
  }, []);

  const handleCloseList = useCallback(() => {
    setView(VIEW_CHAT);
  }, []);

  const handleBackToList = useCallback(() => {
    setView(VIEW_LIST);
  }, []);

  const handleSetActivePanel = useCallback(
    (panel) => {
      if (panel === VIEW_LIST || panel === "left") {
        handleBackToList();
      } else {
        setView(VIEW_CHAT);
      }
    },
    [handleBackToList]
  );

  useEffect(() => {
    if (!selectedContact && view === VIEW_CHAT) {
      setView(VIEW_LIST);
    }
  }, [selectedContact, view]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mobile:view-change", { detail: view }));
  }, [view]);

  return (
    <div className="chat-page-container is-mobile">
      {view === VIEW_LIST && (
        <MobileConversationList
          onSelectContact={handleSelectContact}
          onClosePanel={handleCloseList}
        />
      )}

      {view === VIEW_CHAT && selectedContact && (
        <MobileChatScreen
          selectedContact={selectedContact}
          onBack={handleBackToList}
          setActivePanel={handleSetActivePanel}
        />
      )}
    </div>
  );
}
