import React, { useState } from "react";

import LeftPanel from "@features/messaging/ui/LeftPanel.jsx";
import ChatWindow from "@features/messaging/ui/ChatWindow.jsx";

import "./Chat.css";

export default function DesktopMessagingLayout() {
  const [selectedContact, setSelectedContact] = useState(null);

  return (
    <div className="chat-page-container is-desktop">
      <div className="chat-layout-flex">
        <div className="left-panel-container">
          <LeftPanel onSelectContact={setSelectedContact} />
        </div>
        <div className="chat-window-container">
          <ChatWindow
            activePanel="chat"
            setActivePanel={() => {}}
            selectedContact={selectedContact}
          />
        </div>
      </div>
    </div>
  );
}
