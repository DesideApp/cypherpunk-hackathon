import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { notify } from "@shared/services/notificationService.js";
import {
  ModalShell,
  UiButton,
  ActionButtons,
  ActionCancelButton,
  ActionPrimaryButton,
  ActionModalCard,
  ActionModalHint,
} from "@shared/ui";
import { validateAmount, isSupportedToken } from "@shared/tokens/tokens.js";
import "./AgreementModal.css";
import "./AgreementModal.css";

const MAX_BODY_LEN = 560;
const MAX_TITLE_LEN = 120;

function nowPlusHours(hours = 24) {
  const d = new Date(Date.now() + hours * 3600 * 1000);
  d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

function toInputDate(value) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const iso = date.toISOString();
  return iso.slice(0, 16);
}

export default function AgreementModal({
  open,
  onClose,
  onSubmit,
  tokens,
  defaultToken,
  selfWallet,
  peerWallet,
  selfLabel,
  peerLabel,
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState(defaultToken || "USDC");
  const [payer, setPayer] = useState(selfWallet);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setAmount("");
    setToken(defaultToken || "USDC");
    setPayer(selfWallet);
    setDeadline("");
    setBusy(false);
    setShowOptions(false);
  }, [open, defaultToken, selfWallet]);

  const payee = useMemo(() => (payer === selfWallet ? peerWallet : selfWallet), [payer, selfWallet, peerWallet]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim()) {
      notify("Title is required.", "error");
      return;
    }
    if (title.length > MAX_TITLE_LEN) {
      notify(`Title cannot exceed ${MAX_TITLE_LEN} characters.`, "error");
      return;
    }
    if (body && body.length > MAX_BODY_LEN) {
      notify(`Description cannot exceed ${MAX_BODY_LEN} characters.`, "error");
      return;
    }

    const trimmedAmount = amount.trim();
    let normalizedAmount = null;
    let normalizedToken = null;

    if (trimmedAmount) {
      const upperToken = String(token || "").toUpperCase();
      if (!isSupportedToken(upperToken)) {
        notify("Unsupported token.", "error");
        return;
      }
      const validation = validateAmount(upperToken, trimmedAmount);
      if (!validation.ok) {
        notify(validation.reason || "Check the amount and token.", "error");
        return;
      }
      const numericAmount = Number(validation.value);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        notify("Amount must be greater than 0.", "error");
        return;
      }
      normalizedAmount = validation.value;
      normalizedToken = upperToken;
    }

    const trimmedBody = body.trim() || null;

    let isoDeadline = null;
    if (deadline) {
      const d = new Date(deadline);
      if (Number.isNaN(d.getTime())) {
        notify("Invalid deadline.", "error");
        return;
      }
      if (d.getTime() <= Date.now()) {
        notify("Deadline must be in the future.", "error");
        return;
      }
      isoDeadline = d.toISOString();
    }

    setBusy(true);
    const result = await onSubmit({
      title: title.trim(),
      body: trimmedBody,
      amount: normalizedAmount,
      token: normalizedToken,
      payer,
      payee,
      deadline: isoDeadline,
    });
    setBusy(false);

    const isExplicitFailure = result && result.ok === false;

    if (!isExplicitFailure) {
      notify("Agreement created.", "success");
      onClose();
    } else if (result?.reason) {
      notify(result.reason, "error");
    }
  };

  const presetDeadline = toInputDate(nowPlusHours());
  const currentDeadline = deadline;
  const payerLabel = selfLabel || "You";
  const counterpartyLabel = peerLabel || "Contact";
  const footer = (
    <ActionButtons>
      <ActionCancelButton onClick={onClose} disabled={busy} />
      <ActionPrimaryButton onClick={handleSubmit} disabled={busy} busy={busy}>
        Create agreement
      </ActionPrimaryButton>
    </ActionButtons>
  );

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="On-chain agreement"
      size="md"
      footer={footer}
    >
      <div className={`action-modal-body${showOptions ? " agreement-modal-body--scroll" : ""}`}>
        <ActionModalCard>
          <label className="action-modal-field">
            <span className="action-modal-field-label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              placeholder="E.g. Website redesign"
              maxLength={MAX_TITLE_LEN}
              autoFocus
              disabled={busy}
              className="action-modal-input"
            />
          </label>

          <label className="action-modal-field">
            <span className="action-modal-field-label">Description (optional)</span>
            <textarea
              value={body}
              onChange={(ev) => setBody(ev.target.value)}
              placeholder="Agreement details (optional)"
              maxLength={MAX_BODY_LEN}
              rows={1}
              disabled={busy}
              className="action-modal-textarea agreement-modal-textarea"
            />
          </label>

          <ActionModalHint>
            Define the terms. Your contact will sign first and then you will sign. We will store a proof on-chain.
          </ActionModalHint>
        </ActionModalCard>

        <div className="action-modal-section agreement-modal-options">
          <div className="action-modal-field">
            <UiButton
              variant="ghost"
              onClick={() => setShowOptions((prev) => !prev)}
              disabled={busy}
              aria-expanded={showOptions}
            >
              {showOptions ? "Hide payment options" : "Add payment details"}
            </UiButton>
          </div>

          {showOptions && (
            <>
              <div className="action-modal-field">
                <span className="action-modal-field-label">Payer → Recipient</span>
                <div className="agreement-payer-toggle" role="radiogroup" aria-label="Select who pays">
                  <button
                    type="button"
                    className={`agreement-toggle ${payer === selfWallet ? "active" : ""}`}
                    onClick={() => setPayer(selfWallet)}
                    disabled={busy}
                    aria-pressed={payer === selfWallet}
                  >
                    I pay ({payerLabel})
                  </button>
                  <button
                    type="button"
                    className={`agreement-toggle ${payer === peerWallet ? "active" : ""}`}
                    onClick={() => setPayer(peerWallet)}
                    disabled={busy}
                    aria-pressed={payer === peerWallet}
                  >
                    {counterpartyLabel} pays
                  </button>
                </div>
              </div>

              <label className="action-modal-field">
                <span className="action-modal-field-label">Amount (optional)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amount}
                  onChange={(ev) => setAmount(ev.target.value)}
                  aria-describedby="agreement-amount-help"
                  disabled={busy}
                  className="action-modal-input"
                />
                <small id="agreement-amount-help" className="action-modal-field-help">
                  {token === "SOL" ? "Recommended minimum 0.001 SOL." : "Up to 2 decimals."}
                </small>
              </label>

              <label className="action-modal-field">
                <span className="action-modal-field-label">Token</span>
                <select
                  value={token}
                  onChange={(ev) => setToken(ev.target.value)}
                  disabled={busy}
                  className="action-modal-select"
                >
                  {tokens.map(({ code, symbol }) => (
                    <option key={code} value={code}>{symbol || code}</option>
                  ))}
                </select>
              </label>

              <label className="action-modal-field">
                <span className="action-modal-field-label">Deadline (optional)</span>
                <input
                  type="datetime-local"
                  value={currentDeadline}
                  min={presetDeadline}
                  onChange={(ev) => setDeadline(ev.target.value)}
                  disabled={busy}
                  className="action-modal-input"
                />
              </label>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

AgreementModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  tokens: PropTypes.arrayOf(PropTypes.shape({ code: PropTypes.string })).isRequired,
  defaultToken: PropTypes.string,
  selfWallet: PropTypes.string,
  peerWallet: PropTypes.string,
  selfLabel: PropTypes.string,
  peerLabel: PropTypes.string,
};
