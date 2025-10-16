import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { notify } from "@shared/services/notificationService.js";
import { ModalShell, UiButton } from "@shared/ui";

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

  const footer = (
    <>
      <UiButton variant="secondary" onClick={onClose} disabled={loading}>
        Cancel
      </UiButton>
      <UiButton onClick={handleConfirm} disabled={loading}>
        Save
      </UiButton>
    </>
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Attach transaction"
      footer={footer}
      modalProps={{ className: "settlement-modal" }}
    >
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
    </ModalShell>
  );
}

SettlementModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};
