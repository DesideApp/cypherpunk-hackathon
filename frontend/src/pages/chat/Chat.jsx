import React, { useState, useEffect } from "react";
import ChatWindow from "@features/messaging/ui/ChatWindow.jsx";
import LeftPanel from "@features/messaging/ui/LeftPanel.jsx";
import { useLayout } from "@features/layout/contexts/LayoutContext";
import "./Chat.css";

function Chat() {
  const { isDesktop, isTablet, isMobile } = useLayout();
  const isMobileLayout = isMobile;

  /** 🔹 Estado del panel activo solo para tablet/mobile */
  const [activePanel, setActivePanel] = useState("left");

  /** 🔹 Estado global del contacto seleccionado */
  const [selectedContact, setSelectedContact] = useState(null);

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    if (isMobileLayout) {
      setActivePanel("chat");
    }
  };

  useEffect(() => {
    if (isMobileLayout && !selectedContact && activePanel !== "left") {
      setActivePanel("left");
    }
  }, [isMobileLayout, selectedContact, activePanel, setActivePanel]);

  const hasSelectedContact = Boolean(
    selectedContact && (selectedContact.pubkey || selectedContact.nickname || selectedContact.wallet || selectedContact.id)
  );

  const shouldShowLeftPanel = !isMobileLayout || activePanel === "left";
  const shouldShowChatWindow = !isMobileLayout || (activePanel === "chat" && hasSelectedContact);

  return (
    <div
      className={`chat-page-container
        ${isDesktop ? "is-desktop" : ""}
        ${isTablet ? "is-tablet" : ""}
        ${isMobile ? "is-mobile" : ""}`}
    >
      <div className="chat-layout-flex">
        {/* LeftPanel */}
        {shouldShowLeftPanel && (
          <div className="left-panel-container">
            <LeftPanel
              onSelectContact={handleSelectContact}
              onClosePanel={
                isMobileLayout ? () => setActivePanel("chat") : undefined
              }
            />
          </div>
        )}

        {/* ChatWindow */}
        {shouldShowChatWindow && (
          <div className="chat-window-container">
            <ChatWindow
              activePanel={activePanel}
              setActivePanel={setActivePanel}
              selectedContact={selectedContact}
            />
          </div>
        )}

        {/* RightPanel eliminado: el layout queda en dos columnas (Left + Chat) */}
      </div>
    </div>
  );
}

export default Chat;
