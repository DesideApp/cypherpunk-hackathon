import React from "react";
import LeftPanel from "@features/messaging/ui/LeftPanel.jsx";

import "./MobileMessaging.css";

export default function MobileConversationList({ onSelectContact, onClosePanel }) {
  return (
    <div className="mobile-screen mobile-conversation-list">
      <LeftPanel onSelectContact={onSelectContact} onClosePanel={onClosePanel} />
    </div>
  );
}

