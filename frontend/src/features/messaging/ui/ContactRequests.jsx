import React, { memo } from "react";
import { Check, X } from "lucide-react";
import "./ContactRequests.css";

const ContactRequests = ({
  receivedRequests = [],
  onAcceptRequest,
  onRejectRequest,
}) => {
  const handleAction = async (pubkey, action) => {
    try {
      if (action === "approve") {
        await onAcceptRequest(pubkey);
      } else {
        await onRejectRequest(pubkey);
      }
    } catch (error) {
      console.error(`❌ Error al ${action} contacto:`, error);
    }
  };

  return (
    <div className="contact-requests-container">
      <div className="contact-requests-header">Incoming Requests</div>

      {receivedRequests.length > 0 ? (
        <ul className="contact-requests-list">
          {receivedRequests.map(({ wallet, nickname }) => (
            <li key={wallet} className="contact-request-item">
              <span className="contact-request-info">
                {nickname
                  ? `${nickname} (${wallet.slice(0, 6)}...${wallet.slice(-4)})`
                  : `${wallet.slice(0, 6)}...${wallet.slice(-4)}`}
              </span>
              <div className="contact-request-actions">
                <button
                  className="contact-request-approve"
                  onClick={() => handleAction(wallet, "approve")}
                  aria-label="Approve contact request"
                >
                  <Check size={16} />
                </button>
                <button
                  className="contact-request-reject"
                  onClick={() => handleAction(wallet, "reject")}
                  aria-label="Reject contact request"
                >
                  <X size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="no-requests">No incoming requests.</div>
      )}
    </div>
  );
};

export default memo(ContactRequests);
