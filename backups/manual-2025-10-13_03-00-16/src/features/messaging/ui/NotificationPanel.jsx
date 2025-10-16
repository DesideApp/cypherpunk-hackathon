import React, { memo } from "react";
import ContactRequests from "./ContactRequests";
import "./NotificationPanel.css";

const NotificationPanel = ({
  receivedRequests = [],
  onAcceptRequest,
  onRejectRequest,
}) => {
  return (
    <div className="notification-panel-container">
      {/* 🔹 Cabecera */}
      <div className="notification-header">
        <div className="notification-title">Notifications</div>
      </div>

      {/* 🔹 Contenido principal */}
      <div className="notifications-section">
        {receivedRequests.length > 0 ? (
          <ContactRequests
            receivedRequests={receivedRequests}
            onAcceptRequest={onAcceptRequest}
            onRejectRequest={onRejectRequest}
          />
        ) : (
          <div className="no-requests-text">
            No contact requests at the moment.
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(NotificationPanel);
