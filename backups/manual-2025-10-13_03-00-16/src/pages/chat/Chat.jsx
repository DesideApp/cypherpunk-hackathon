import React, { useState } from "react";
import ChatWindow from "@features/messaging/ui/ChatWindow.jsx";
import LeftPanel from "@features/messaging/ui/LeftPanel.jsx";
import { useLayout } from "@features/layout/contexts/LayoutContext";
import "./Chat.css";

function Chat() {
  const { isDesktop, isTablet, isMobile } = useLayout();

  /** 🔹 Estado del panel activo solo para tablet/mobile */
  const [activePanel, setActivePanel] = useState("left");

  /** 🔹 Estado global del contacto seleccionado */
  const [selectedContact, setSelectedContact] = useState(null);

  return (
    <div
      className={`chat-page-container
        ${isDesktop ? "is-desktop" : ""}
        ${isTablet ? "is-tablet" : ""}
        ${isMobile ? "is-mobile" : ""}`}
    >
      <div className="chat-layout-flex">
        {/* LeftPanel: siempre visible en desktop, solo si activo en tablet/mobile */}
        {(isDesktop || activePanel === "left") && (
          <div className="left-panel-container">
            <LeftPanel onSelectContact={setSelectedContact} />
          </div>
        )}

        {/* ChatWindow: siempre visible */}
        <div className="chat-window-container">
          <ChatWindow
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            selectedContact={selectedContact}
          />
        </div>

        {/* RightPanel eliminado: el layout queda en dos columnas (Left + Chat) */}
      </div>
    </div>
  );
}

export default Chat;
