import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { 
  ModalShell, 
  ActionButtons, 
  ActionCancelButton, 
  ActionPrimaryButton,
  ActionModalCard,
  ActionModalTokenHeader,
  ActionModalIdentityFlow,
  ActionModalHint,
  ActionModalPresetAmounts,
  ActionModalCustomRow,
  ActionModalCustomInput,
  ActionModalNoteInput,
} from "@shared/ui";
import { SOLANA } from "@shared/config/env.js";
import { listBuyTokens, INPUT_MINT } from "@features/messaging/config/buyTokens.js";
import { getTokenMeta } from "@features/messaging/config/tokenMeta.js";
import { fetchPrices } from "@shared/services/priceService.js";

const MAX_REASON_LEN = 120;

function shortAddress(value) {
  if (!value) return "";
  const str = String(value);
  if (str.length <= 10) return str;
  return `${str.slice(0, 4)}…${str.slice(-4)}`;
}

function formatUsd(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  });
  return formatter.format(value);
}

function formatSolAmount(value) {
  const numeric = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(numeric)) return null;
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: numeric < 1 ? 4 : 2,
  });
  return formatter.format(numeric);
}

export default function RequestModal({
  open = false,
  onClose,
  onSubmit,
  peerLabel,
  selfLabel,
  defaultToken = "SOL",
  peerPubkey,
  peerNickname,
}) {
  const [amount, setAmount] = useState(0.001);
  const [customAmount, setCustomAmount] = useState("");
  const [token, setToken] = useState(defaultToken);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState({});
  const [selectedMeta, setSelectedMeta] = useState(null);

  // EXACTO como BuyToken: usar listBuyTokens con outputMint
  const supportedTokens = useMemo(() => listBuyTokens(SOLANA.CHAIN), []);
  
  // EXACTO como BuyToken: selected con code + outputMint
  const selected = useMemo(() => {
    const tokenObj = supportedTokens.find((t) => t.code === token);
    if (!tokenObj) return null;
    return {
      code: tokenObj.code,
      outputMint: tokenObj.outputMint || INPUT_MINT,
    };
  }, [token, supportedTokens]);

  // Cargar metadata del token (ASYNC)
  useEffect(() => {
    if (!selected) {
      setSelectedMeta(null);
      return;
    }
    
    let alive = true;
    getTokenMeta(selected.code)
      .then((meta) => {
        console.log('[RequestModal] getTokenMeta resolved with:', meta);
        if (alive) {
          console.log('[RequestModal] Setting selectedMeta to:', meta);
          setSelectedMeta(meta);
        }
      })
      .catch((err) => {
        console.warn('Failed to load token meta:', err);
        if (alive) setSelectedMeta(null);
      });
    
    return () => { alive = false; };
  }, [selected]);

  // Fetch prices EXACTO como BuyToken
  useEffect(() => {
    if (!open) return;
    try {
      const ids = new Set(
        supportedTokens
          .map((t) => t.outputMint)
          .filter(Boolean)
          .concat(INPUT_MINT)
      );
      if (!ids.size) return;
      let alive = true;
      fetchPrices(Array.from(ids))
        .then((data) => {
          if (!alive) return;
          setPrices(data || {});
        })
        .catch(() => {});
      return () => { alive = false; };
    } catch {}
  }, [open, supportedTokens]);

  // EXACTO como BuyToken: selectedPriceEntry
  const selectedPriceEntry = useMemo(() => {
    if (!selected?.outputMint) return null;
    return prices?.[selected.outputMint] || null;
  }, [selected, prices]);

  const tokenPrice = typeof selectedPriceEntry?.usdPrice === "number" ? selectedPriceEntry.usdPrice : null;
  const priceLabel = tokenPrice != null ? formatUsd(tokenPrice) : null;
  
  const solPriceEntry = prices?.[INPUT_MINT] || null;
  const solUsdPrice = typeof solPriceEntry?.usdPrice === "number" ? solPriceEntry.usdPrice : null;

  // Conversión USD del amount actual
  const usdValue = useMemo(() => {
    const amt = customAmount ? parseFloat(customAmount) : amount;
    if (!amt || !Number.isFinite(amt)) return null;
    if (tokenPrice == null) return null;
    if (token === "SOL" && solUsdPrice != null) {
      return formatUsd(amt * solUsdPrice);
    }
    return formatUsd(amt * tokenPrice);
  }, [amount, customAmount, token, tokenPrice, solUsdPrice]);

  // Preset amounts
  const presetAmounts = [0.001, 0.1, 1];

  const handlePresetClick = (val) => {
    setAmount(val);
    setCustomAmount(""); // Clear custom
  };

  const handleCustomChange = (e) => {
    const val = e.target.value;
    setCustomAmount(val);
    const parsed = parseFloat(val);
    if (Number.isFinite(parsed)) {
      setAmount(parsed);
    }
  };

  const handleSubmit = async () => {
    const finalAmount = customAmount ? parseFloat(customAmount) : amount;
    if (!finalAmount || !token) return;

    setBusy(true);
    try {
      await onSubmit?.({
        kind: "request",
        amount: finalAmount,
        token,
        reason: reason.trim() || undefined,
      });
      // Reset
      setAmount(0.001);
      setCustomAmount("");
      setReason("");
      onClose?.();
    } catch (error) {
      console.error("Request failed:", error);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <ActionButtons>
      <ActionCancelButton onClick={onClose} disabled={busy} />
      <ActionPrimaryButton 
        onClick={handleSubmit} 
        disabled={busy || (!amount && !customAmount) || !token}
        busy={busy}
      >
        Request
      </ActionPrimaryButton>
    </ActionButtons>
  );

  const conversionPrimary = usdValue ? `≈ ${usdValue} USD` : null;
  const conversionSecondary = `Requesting ${amount || "—"} ${token}`;

  console.log('[RequestModal] About to render with selectedMeta:', selectedMeta);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Request payment"
      footer={footer}
      size="md"
    >
      <ActionModalCard meta={selectedMeta}>
        <ActionModalTokenHeader
          meta={selectedMeta}
          token={token}
          conversionPrimary={conversionPrimary}
          conversionSecondary={conversionSecondary}
        />

        {(peerLabel || selfLabel) && (
          <ActionModalIdentityFlow
            direction="incoming"
            left={{
              title: selfLabel || "You",
              subtitle: null,
              titlePlaceholder: "You",
            }}
            right={{
              title: peerNickname || (
                <span className="skeleton skeleton--text">Loading…</span>
              ),
              subtitle: peerPubkey ? shortAddress(peerPubkey) : null,
            }}
          />
        )}

        <ActionModalHint>
          Blinks are executed from your connected wallet. Your contact will review and approve the request.
        </ActionModalHint>
      </ActionModalCard>

      <ActionModalPresetAmounts
        amounts={presetAmounts}
        selected={amount}
        onSelect={handlePresetClick}
        disabled={busy}
      />

      <ActionModalCustomRow
        left={
          <ActionModalCustomInput
            step="0.001"
            min="0"
            placeholder="Custom"
            value={customAmount}
            onChange={handleCustomChange}
            disabled={busy}
          />
        }
        right={
          <ActionModalNoteInput
            placeholder="Thanks for the call"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={MAX_REASON_LEN}
            disabled={busy}
          />
        }
      />
    </ModalShell>
  );
}

RequestModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func,
  peerLabel: PropTypes.string,
  selfLabel: PropTypes.string,
  defaultToken: PropTypes.string,
  peerPubkey: PropTypes.string,
  peerNickname: PropTypes.string,
};
