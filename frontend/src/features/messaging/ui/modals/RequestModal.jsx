import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { 
  ModalShell, 
  ActionButtons, 
  ActionCancelButton, 
  ActionPrimaryButton 
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
        if (alive) setSelectedMeta(meta);
      })
      .catch((err) => {
        console.warn('Failed to load token meta:', err);
        if (alive) setSelectedMeta(null);
      });
    
    return () => { alive = false; };
  }, [selected]);

  // EXACTO como BuyToken: estilos dinámicos desde selectedMeta
  const cardStyle = selectedMeta
    ? {
        "--card-accent": selectedMeta.tint || "rgba(59,130,246,0.7)",
        "--card-sheen": selectedMeta.glow || "rgba(59,130,246,0.12)",
        "--card-bg": selectedMeta.background || "rgba(255,255,255,0.05)",
      }
    : undefined;

  const selectedIconStyle = selectedMeta
    ? {
        ...(selectedMeta.tint ? { "--icon-outline": selectedMeta.tint } : {}),
        ...(selectedMeta.background ? { "--icon-bg": selectedMeta.background } : {}),
        ...(selectedMeta.glow ? { "--icon-glow": selectedMeta.glow } : {}),
      }
    : undefined;

  const selectedInnerStyle = selectedMeta?.iconScale ? { "--icon-scale": selectedMeta.iconScale } : undefined;

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

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Request payment"
      footer={footer}
      size="md"
    >
      {/* Card interna estilo Blink - TODA la info importante aquí */}
      <div className="action-modal-card" style={cardStyle}>
        {/* ===== 1. TOKEN HEADER: Logo + conversión ===== */}
        <div className="action-modal-token-header">
          <div className="action-modal-token-logo" style={selectedIconStyle}>
            <span className="action-modal-token-logo-inner" style={selectedInnerStyle}>
              {selectedMeta?.icon ? (
                <img 
                  src={selectedMeta.icon} 
                  alt={token}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { 
                    e.currentTarget.onerror = null; 
                    e.currentTarget.src = '/tokens/default.svg'; 
                  }}
                />
              ) : (
                <span style={{ fontSize: '1.5rem' }}>🪙</span>
              )}
            </span>
          </div>
          
          <div className="action-modal-token-info">
            <p className="action-modal-token-name">{token}</p>
            <p className="action-modal-token-subtitle">{selectedMeta?.name || "Solana"}</p>
          </div>
          
          <div className="action-modal-token-conversion">
            {usdValue ? (
              <p className="action-modal-token-usd">≈ ${usdValue} USD</p>
            ) : (
              <p className="action-modal-token-usd">—</p>
            )}
            <p className="action-modal-token-action-text">
              Requesting {amount || "—"} {token}
            </p>
          </div>
        </div>

        {/* ===== 2. TRANSACTION FLOW: Me ← Contact ===== */}
        {(peerLabel || selfLabel) && (
          <div className="action-modal-transaction-flow">
            {/* Parte 1: YO (receptor) */}
            <div className="action-modal-party">
              <div className="action-modal-avatar action-modal-avatar--small">
                <span>👤</span>
              </div>
              <div className="action-modal-identity-info">
                <p className="action-modal-identity-name">
                  <span className="skeleton skeleton--text">Loading...</span>
                </p>
                {selfLabel && (
                  <p className="action-modal-identity-address">{selfLabel}</p>
                )}
              </div>
            </div>

            {/* Flecha: indica dirección del pago (← él me paga) */}
            <span className="action-modal-arrow">←</span>

            {/* Parte 2: CONTACTO (pagador) */}
            <div className="action-modal-party">
              <div className="action-modal-avatar action-modal-avatar--small">
                <span>👤</span>
              </div>
              <div className="action-modal-identity-info">
                <p className="action-modal-identity-name">
                  {peerNickname || <span className="skeleton skeleton--text">Loading...</span>}
                </p>
                {peerPubkey && (
                  <p className="action-modal-identity-address">
                    {peerPubkey.slice(0, 4)}...{peerPubkey.slice(-4)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== 3. HINT TEXT ===== */}
        <p className="action-modal-hint">
          Blinks are executed from your connected wallet. Your contact will review and approve the request.
        </p>
      </div>
      {/* Fin de action-modal-card */}

      {/* ===== 4. AMOUNT BUTTONS (FUERA de la card) ===== */}
      <div className="action-modal-amounts">
        {presetAmounts.map((val) => (
          <button
            key={val}
            type="button"
            className={`action-modal-amount-button ${amount === val.toString() ? 'selected' : ''}`}
            onClick={() => handlePresetClick(val)}
            disabled={busy}
          >
            {val}
          </button>
        ))}
      </div>

      {/* ===== 5. CUSTOM ROW: Custom input + note ===== */}
      <div className="action-modal-custom-row">
        <input
          type="number"
          step="0.001"
          min="0"
          placeholder="Custom"
          value={customAmount}
          onChange={handleCustomChange}
          className="action-modal-custom-input"
          disabled={busy}
        />
        
        <input
          type="text"
          maxLength={MAX_REASON_LEN}
          placeholder="Thanks for the call"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="action-modal-note-input"
          disabled={busy}
        />
      </div>
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
