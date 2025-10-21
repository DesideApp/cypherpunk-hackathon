import React, { useCallback } from "react";
import ChatWindow from "@features/messaging/ui/ChatWindow.jsx";

import "./MobileMessaging.css";

export default function MobileChatScreen({ selectedContact, onBack, setActivePanel }) {
  const handleSetActivePanel = useCallback(
    (panel) => {
      if (panel === "left") {
        onBack();
      }
      if (typeof setActivePanel === "function") {
        setActivePanel(panel);
      }
    },
    [onBack, setActivePanel]
  );

  return (
    <div className="mobile-screen mobile-chat-screen">
      <ChatWindow
        selectedContact={selectedContact}
        activePanel="chat"
        setActivePanel={handleSetActivePanel}
        allowMobileMenu={false}
      />
    </div>
  );
}
