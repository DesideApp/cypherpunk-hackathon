import React, { memo, useState, useEffect } from "react";
import { FaCheckCircle, FaTimes } from "react-icons/fa";
import { ChevronRight } from "lucide-react";
import useAddContactManager from "@features/contacts/hooks/useAddContactManager";
import { notify } from "@shared/services/notificationService.js";
import SentRequestsList from "./SentRequestsList";
import { rejectContact } from "@features/contacts/services/contactService.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import "./AddContactForm.css";

const AddContactForm = ({ onContactAdded, resetTrigger }) => {
  const {
    pubkey,
    setPubkey,
    isValidPubkey,
    isLoading,
    textareaRef,
    handleAddContact,
    sentRequests: originalSentRequests,
    loadSentRequests,
    clearInput,
  } = useAddContactManager(onContactAdded);

  const { isAuthenticated, isLoading: authLoading, ensureReady } = useAuthManager();

  const [showSentScreen, setShowSentScreen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // 🔄 Reset al cerrar AddContactForm
  useEffect(() => {
    setShowSentScreen(false);
    setExpandedIndex(null);
  }, [resetTrigger]);

  // ❌ Quitamos ensureReady en el montaje (solo cargamos si ya está autenticado)
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadSentRequests();
    }
  }, [isAuthenticated, authLoading, loadSentRequests]);

  // ❌ Quitamos ensureReady en el abrir pestaña (solo cargamos si ya está autenticado)
  useEffect(() => {
    if (showSentScreen && isAuthenticated && !authLoading) {
      loadSentRequests();
    }
  }, [showSentScreen, isAuthenticated, authLoading, loadSentRequests]);

  const handleClear = () => {
    clearInput();
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleInputChange = (e) => {
    const clean = e.target.value.replace(/\s+/g, "").slice(0, 88);
    setPubkey(clean);
  };

  const handleSendRequest = async () => {
    try {
      // 🔒 Verificar login/autenticación antes de enviar
      const ok = await ensureReady();
      if (!ok) return;

      await handleAddContact();
      notify("Contact request sent successfully!", "success");
    } catch (e) {
      console.error(e);
      notify("Failed to send contact request.", "error");
    }
  };

  const handleCancelRequest = async (wallet) => {
    try {
      const ok = await ensureReady();
      if (!ok) return;

      await rejectContact(wallet);
      notify("❌ Contact request cancelled.", "info");

      if (isAuthenticated && !authLoading) {
        loadSentRequests();
      }
    } catch (e) {
      console.error("❌ Error cancelling contact request:", e);
      notify("❌ Failed to cancel contact request.", "error");
    }
  };

  // ⏎ Enviar con Enter
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && isValidPubkey) {
        handleSendRequest();
      }
    }
  };

  return (
    <div className="add-contact-container">
      {!showSentScreen ? (
        <div className="form-panel slide-in">
          <div className="contact-header">
            <div className="contact-title">Sent Requests</div>
            <button
              className="sent-request-trigger"
              onClick={() => {
                if (!isAuthenticated) {
                  notify("Inicia sesión para ver tus solicitudes enviadas.", "info");
                  return;
                }
                setShowSentScreen(true);
              }}
              aria-label="Open sent requests"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="inputt-wrapper">
            <div className="textarea-box">
              <textarea
                ref={textareaRef}
                value={pubkey}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Friend's Wallet"
                disabled={isLoading}
                aria-label="Friend's wallet pubkey"
              />
              <div className="input-icons">
                <span
                  className={`validation-icon ${isValidPubkey ? "valid" : "inactive"}`}
                  aria-label={isValidPubkey ? "Valid pubkey" : "Invalid pubkey"}
                >
                  <FaCheckCircle />
                </span>
                {pubkey && (
                  <span
                    className="clear-icon"
                    onClick={handleClear}
                    aria-label="Clear input"
                  >
                    <FaTimes />
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            className={`send-request-button ${isValidPubkey ? "active" : "inactive"}`}
            onClick={handleSendRequest}
            disabled={isLoading || !isValidPubkey}
            aria-label="Send contact request"
          >
            {isLoading ? "Sending..." : "Send request"}
          </button>
        </div>
      ) : (
        <SentRequestsList
          sentRequests={originalSentRequests}
          expandedIndex={expandedIndex}
          copiedIndex={copiedIndex}
          setExpandedIndex={setExpandedIndex}
          setCopiedIndex={setCopiedIndex}
          onBack={() => setShowSentScreen(false)}
          onCancelRequest={handleCancelRequest}
        />
      )}
    </div>
  );
};

export default memo(AddContactForm);
