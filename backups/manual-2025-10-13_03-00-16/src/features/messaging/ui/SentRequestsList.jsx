import React, { memo } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";

const shortenAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
};

const SentRequestsList = ({
  sentRequests = [],
  expandedIndex,
  copiedIndex,
  setExpandedIndex,
  setCopiedIndex,
  onBack,
  onCancelRequest,
}) => {
  const toggleExpand = (index) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  const handleCopy = async (wallet, index) => {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("❌ Error copying wallet:", err);
    }
  };

  return (
    <div className="sent-panel slide-in">
      {/* Cabecera con botón back */}
      <div className="sent-panel-header">
        <button
          className="back-button"
          onClick={onBack}
          aria-label="Back to add contact"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Lista de solicitudes */}
      <div className="sent-requests-box">
        {sentRequests.length > 0 ? (
          <ul className="requests-list">
            {sentRequests.map(({ wallet, nickname }, index) => {
              const isExpanded = expandedIndex === index;
              return (
                <li
                  key={wallet}
                  className={`sent-request-item ${
                    isExpanded ? "expanded" : ""
                  }`}
                >
                  {/* Cabecera contraída */}
                  <div
                    className="sent-request-header"
                    onClick={() => toggleExpand(index)}
                  >
                    <span className="pubkey-short">
                      {nickname
                        ? `${nickname} (${shortenAddress(wallet)})`
                        : shortenAddress(wallet)}
                    </span>
                    <span className="status-label">Pending</span>
                    <span className="expand-icon">
                      {isExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </span>
                  </div>

                  {/* Detalles desplegados */}
                  {isExpanded && (
                    <div className="sent-request-details">
                      <div className="wallet-full-row">
                        <span className="wallet-full">{wallet}</span>
                        <button
                          className="copy-button"
                          onClick={() => handleCopy(wallet, index)}
                          aria-label="Copy Wallet"
                        >
                          {copiedIndex === index ? (
                            <Check size={16} color="#28a745" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                      <button
                        className="cancel-button"
                        onClick={() => onCancelRequest?.(wallet)}
                      >
                        Cancel Request
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="no-requests text-gray-500">No pending requests.</p>
        )}
      </div>
    </div>
  );
};

export default memo(SentRequestsList);
