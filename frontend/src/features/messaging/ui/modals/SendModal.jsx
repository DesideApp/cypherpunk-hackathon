import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  ModalShell,
  ActionButtons,
  ActionCancelButton,
  ActionPrimaryButton,
  ActionModalCard,
  ActionModalTokenHeader,
  ActionModalIdentityFlow,
  ActionModalCustomRow,
  ActionModalPresetAmounts,
  ActionModalHint,
} from "@shared/ui";
import { listSupportedTokens } from "@shared/tokens/tokens.js";
import { getTokenMeta } from "@features/messaging/config/tokenMeta.js";

function shortAddress(value) {
  if (!value) return "";
  const str = String(value);
  if (str.length <= 10) return str;
  return `${str.slice(0, 4)}…${str.slice(-4)}`;
}

const PRESET_AMOUNTS = [0.001, 0.1, 1];

export default function SendModal({
  open = false,
  onClose = () => {},
  onSubmit = () => {},
  peerLabel = null,
  peerPubkey = null,
  selfLabel = null,
  defaultToken = "SOL",
}) {
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState(defaultToken);
  const [busy, setBusy] = useState(false);

  const supportedTokens = listSupportedTokens();
  
  // Cargar metadata del token (ASYNC) - IGUAL que BuyTokenModal
  const selectedMeta = useMemo(() => getTokenMeta(token), [token]);

  const handleSubmit = async () => {
    if (!amount || !token) return;

    setBusy(true);
    try {
      await onSubmit?.({
        kind: "send",
        amount,
        token,
      });
      // Reset
      setAmount("");
      onClose?.();
    } catch (error) {
      console.error("Send failed:", error);
    } finally {
      setBusy(false);
    }
  };

  const conversionSecondary = useMemo(
    () => `Sending ${amount || "—"} ${token}`,
    [amount, token]
  );

  const footer = (
    <ActionButtons>
      <ActionCancelButton onClick={onClose} disabled={busy} />
      <ActionPrimaryButton
        onClick={handleSubmit}
        disabled={busy || !amount || !token}
        busy={busy}
        busyText="Sending…"
      >
        Pay
      </ActionPrimaryButton>
    </ActionButtons>
  );

  const handlePresetSelect = (value) => {
    setAmount(String(value));
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Send money"
      footer={footer}
      size="md"
    >
      <ActionModalCard meta={selectedMeta}>
        <ActionModalTokenHeader
          meta={selectedMeta}
          token={token}
          conversionSecondary={conversionSecondary}
        />

        {(selfLabel || peerLabel) && (
          <ActionModalIdentityFlow
            direction="outgoing"
            left={{
              title: selfLabel || "You",
              subtitle: null,
              titlePlaceholder: "You",
            }}
            right={{
              title:
                peerLabel || (
                  <span className="skeleton skeleton--text">Loading…</span>
                ),
              subtitle: peerPubkey ? shortAddress(peerPubkey) : null,
            }}
          />
        )}

        <ActionModalHint>
          Blinks are executed from your connected wallet. Review the transfer
          in your wallet before confirming.
        </ActionModalHint>
      </ActionModalCard>

      <ActionModalPresetAmounts
        amounts={PRESET_AMOUNTS}
        selected={amount}
        onSelect={handlePresetSelect}
        disabled={busy}
      />

      <ActionModalCustomRow
        left={
          <input
            type="number"
            step="0.001"
            min="0"
            placeholder="Custom"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="action-modal-custom-input"
            disabled={busy}
            title={
              token === "SOL"
                ? "Recommended minimum 0.001 SOL."
                : "Up to 2 decimals."
            }
          />
        }
        right={
          <input
            type="text"
            placeholder="Add a note (optional)"
            className="action-modal-note-input"
            disabled
          />
        }
      />
    </ModalShell>
  );
}

SendModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func,
  peerLabel: PropTypes.string,
  peerPubkey: PropTypes.string,
  selfLabel: PropTypes.string,
  defaultToken: PropTypes.string,
};
