import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { notify } from "@shared/services/notificationService.js";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{20,}$/;

export default function SettlementModal({ open, onClose, onSubmit, loading }) {
  const [txSig, setTxSig] = useState("");

  useEffect(() => {
    if (!open) return;
    setTxSig("");
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    const trimmed = txSig.trim();
    if (!trimmed) {
      notify("Enter the payment transaction.", "warning");
      return;
    }
    if (!BASE58_RE.test(trimmed)) {
      notify("The transaction looks invalid.", "error");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="chat-action-modal-overlay" role="presentation">
      <div
        className="chat-action-modal settlement-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-modal-title"
      >
        <header className="chat-action-header">
          <h2 id="settlement-modal-title">Attach transaction</h2>
          <button
            type="button"
            className="chat-action-close"
            onClick={onClose}
            aria-label="Close"
            disabled={loading}
          >
            ×
          </button>
        </header>

        <div className="chat-action-body">
          <p className="chat-action-description">
            Paste the payment transaction to mark this agreement as settled.
          </p>
          <label className="chat-action-field">
            <span>Transaction (txSig)</span>
            <input
              type="text"
              value={txSig}
              onChange={(ev) => setTxSig(ev.target.value)}
              placeholder="E.g. 4aQh..."
              disabled={loading}
            />
          </label>
        </div>

        <footer className="chat-action-footer">
          <button type="button" className="chat-action-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="agreement-primary" onClick={handleConfirm} disabled={loading}>
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}

SettlementModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};
