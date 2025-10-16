import React, { useMemo, useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useRpc } from "@wallet-adapter/core/contexts/RpcProvider";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { notify } from "@shared/services/notificationService.js";
import { FEATURES, SOLANA } from "@shared/config/env.js";
import { listBuyTokens, INPUT_MINT } from "@features/messaging/config/buyTokens.js";
import { getTokenMeta } from "@features/messaging/config/tokenMeta.js";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { getAllowedTokens, clearAllowedTokensCache } from "@features/messaging/services/allowedTokensService.js";
import { executeBuyBlink } from "@features/messaging/services/buyBlinkService.js";
import { fetchPrices } from "@shared/services/priceService.js";
import { ModalShell, UiButton, UiChip } from "@shared/ui";
import TokenSearch from "../TokenSearch.jsx";
import TokenButton from "./TokenButton.jsx";
import "./BuyTokenModal.css";

function deserializeTransaction(base64) {
  const raw = Buffer.from(base64, "base64");
  try {
    return VersionedTransaction.deserialize(raw);
  } catch (_) {
    return Transaction.from(raw);
  }
}

function isUserCancelled(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("reject") || message.includes("cancel") || message.includes("decline") || error?.code === 4001;
}

function shortAddress(value) {
  if (!value) return "";
  const str = String(value);
  if (str.length <= 10) return str;
  return `${str.slice(0, 4)}…${str.slice(-4)}`;
}

function toNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatSolAmount(value) {
  const numeric = toNumeric(value);
  if (numeric == null) return null;
  const formatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: numeric < 1 ? 4 : 2,
  });
  return formatter.format(numeric);
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

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const formatter = new Intl.NumberFormat(undefined, {
    signDisplay: "always",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatter.format(value)}%`;
}

function formatTokenAmount(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const formatter = new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: value >= 1 ? 6 : 4,
  });
  return formatter.format(value);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return null;
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSeconds = Math.round(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 48) return `${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d`;
}

export default function BuyTokenModal({
  open = false,
  presetToken = null,
  presetAmount = null,
  shareOnComplete = true,
  onClose,
  onBlinkShared,
}) {
  const { pubkey: myWallet } = useAuthManager();
  const walletCtx = useWallet();
  const { connection } = useRpc();
  const adapter = walletCtx?.adapter || null;

  const [backendTokens, setBackendTokens] = useState(null);
  const [tokensLoading, setTokensLoading] = useState(false);

  // Cargar tokens desde el backend (limpia cache para evitar residuos como WIF)
  useEffect(() => {
    if (!open) return;
    
    const loadTokens = async () => {
      setTokensLoading(true);
      try {
        try { clearAllowedTokensCache(); } catch {}
        const data = await getAllowedTokens();
        setBackendTokens(data);
      } catch (error) {
        console.warn("[BuyTokenModal] failed to load backend tokens, using fallback", error);
        setBackendTokens(null);
      } finally {
        setTokensLoading(false);
      }
    };

    loadTokens();
  }, [open]);

  const fallbackTokens = useMemo(() => listBuyTokens(SOLANA.CHAIN), []);

  const fallbackLookup = useMemo(
    () => new Map(fallbackTokens.map((t) => [t.code, t])),
    [fallbackTokens]
  );

  const tokens = useMemo(() => {
    // Leer tokens dinámicamente desde backend (sin filtro hardcodeado)
    if (backendTokens?.tokens) {
      const backendTokensList = backendTokens.tokens
        .map((token) => {
        const fallback = fallbackLookup.get(token.code) || {};
        return {
          code: token.code,
          label: token.label || fallback.label || token.code,
          outputMint: token.mint || fallback.outputMint || null,
          decimals: token.decimals ?? fallback.decimals,
          dialToUrl: fallback.dialToUrl || null,
          maxAmount: token.maxAmount ?? fallback.maxAmount,
          minAmount: token.minAmount ?? fallback.minAmount,
        };
      });

      console.debug("[BuyTokenModal] using backend tokens", {
        count: backendTokensList.length,
        tokens: backendTokensList.map((t) => ({ code: t.code, label: t.label, hasMint: !!t.outputMint })),
      });

      return backendTokensList;
    }

    console.debug("[BuyTokenModal] using fallback tokens", {
      count: fallbackTokens.length,
      tokens: fallbackTokens.map((t) => ({ code: t.code, label: t.label, hasMint: !!t.outputMint })),
    });

    // Fallback local (todos los tokens disponibles)
    return fallbackTokens;
  }, [backendTokens, fallbackLookup, fallbackTokens]);

  const [step, setStep] = useState("pick-token");
  const [selected, setSelected] = useState(null); // { code, outputMint }
  const [amount, setAmount] = useState(0.1);
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState({});
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState(null);

  // Fetch USD prices for visible tokens (Jupiter Price API v3)
  useEffect(() => {
    try {
      const ids = new Set(
        (tokens || [])
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
          setPricesUpdatedAt(Date.now());
        })
        .catch(() => {});
      return () => { alive = false; };
    } catch {}
  }, [tokens]);

  const amountOptions = [0.01, 0.1, 0.5, 1];
  const inlineEnabled = FEATURES.PAYMENT_INLINE_EXEC;
  const inlineCapable = inlineEnabled && adapter && connection;

  const walletPublicKey = walletCtx?.publicKey;
  const walletAddress = useMemo(() => {
    if (walletPublicKey?.toBase58) {
      try {
        return walletPublicKey.toBase58();
      } catch (_) {
        return myWallet || null;
      }
    }
    if (typeof walletPublicKey === "string" && walletPublicKey) {
      return walletPublicKey;
    }
    return myWallet || null;
  }, [walletPublicKey, myWallet]);

  const proceedEnabled = selected && selected.outputMint && amount > 0 && walletAddress;

  const selectedMeta = useMemo(() => (selected ? getTokenMeta(selected.code) : null), [selected]);
  const selectedPriceEntry = useMemo(() => {
    if (!selected?.outputMint) return null;
    return prices?.[selected.outputMint] || null;
  }, [selected, prices]);

  const tokenPrice = typeof selectedPriceEntry?.usdPrice === "number" ? selectedPriceEntry.usdPrice : null;
  const priceLabel = tokenPrice != null ? formatUsd(tokenPrice) : null;
  const changeRaw = typeof selectedPriceEntry?.priceChange24h === "number" ? selectedPriceEntry.priceChange24h : null;
  const changeLabel = changeRaw != null ? formatPercent(changeRaw) : null;
  const changeTone = typeof changeRaw === "number" ? (changeRaw > 0 ? "positive" : changeRaw < 0 ? "negative" : null) : null;
  const solPriceEntry = prices?.[INPUT_MINT] || null;
  const solUsdPrice = typeof solPriceEntry?.usdPrice === "number" ? solPriceEntry.usdPrice : null;
  const shortMint = selected?.outputMint ? shortAddress(selected.outputMint) : null;
  const availableAmountLabel = formatSolAmount(amount);

  const estimatedTokens = useMemo(() => {
    if (!selected || !amount || tokenPrice == null || solUsdPrice == null) return null;
    if (!Number.isFinite(amount) || tokenPrice <= 0 || solUsdPrice <= 0) return null;
    return (amount * solUsdPrice) / tokenPrice;
  }, [selected, amount, tokenPrice, solUsdPrice]);

  const estimatedTokensLabel = estimatedTokens != null ? formatTokenAmount(estimatedTokens) : null;
  const quoteLabel =
    estimatedTokensLabel && selected?.code ? `≈ ${estimatedTokensLabel} ${selected.code}` : "Quote pending";
  const quoteSubLabel = availableAmountLabel ? `Spending ${availableAmountLabel} SOL` : "Choose an amount";
  const pricesAgeLabel = pricesUpdatedAt ? formatRelativeTime(pricesUpdatedAt) : null;
  const sourceLabelParts = ["Price via Jupiter"];
  if (pricesAgeLabel) sourceLabelParts.push(`updated ${pricesAgeLabel} ago`);
  const priceSourceLabel = sourceLabelParts.join(" · ");

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

  const pickToken = (t) => {
    if (!t?.outputMint) {
      notify("Token not configured yet. Ask an admin to set its mint.", "warning");
      return;
    }
    setSelected(t);
    setStep("pick-amount");
  };

  const executeTransaction = async (serializedTx) => {
    const tx = deserializeTransaction(serializedTx);
    let signature = null;
    if (typeof adapter.sendTransaction === "function") {
      signature = await adapter.sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
    } else if (typeof adapter.signTransaction === "function") {
      const signed = await adapter.signTransaction(tx);
      const raw = signed.serialize();
      signature = await connection.sendRawTransaction(raw, { skipPreflight: false });
    } else {
      throw new Error("Wallet adapter cannot send transactions.");
    }
    if (!signature) throw new Error("Wallet did not return a signature.");
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  };

  const onBuyNow = useCallback(async () => {
    if (!proceedEnabled) return;
    if (!walletAddress) {
      notify("Connect your wallet before buying.", "warning");
      return;
    }

    if (!inlineCapable) {
      notify("Inline execution is required. Connect your wallet and try again.", "warning");
      return;
    }

    setBusy(true);

    try {
      notify("Opening your wallet…", "info");
      const response = await executeBuyBlink({
        token: selected.code,
        amount,
        account: walletAddress,
      });

      if (!response || response.type !== "transaction" || typeof response.transaction !== "string") {
        throw new Error("Unexpected response from buy execution.");
      }

      const signature = await executeTransaction(response.transaction);
      const expectedOut = response?.info?.expectedOut;
      const successMessage = expectedOut
        ? `Purchase completed ≈ ${expectedOut} ${selected.code}`
        : "Purchase completed.";

      try {
        if (shareOnComplete !== false && typeof onBlinkShared === "function") {
          onBlinkShared({
            kind: "buy",
            token: selected.code,
            amountInSol: amount,
            expectedOut,
            actionUrl: null,
            solanaActionUrl: null,
            dialToUrl: selected.dialToUrl || null,
            blinkApiUrl: null,
            txSig: signature,
            source: "me",
            meta: {
              outputMint: selected.outputMint || null,
              priceImpactPct: response?.info?.priceImpactPct ?? null,
            },
          });
        }
      } catch (shareError) {
        console.warn("[blink] share failed", shareError);
      }

      notify(successMessage, "success");
      onClose?.();
    } catch (error) {
      console.error("[blink] buy failed", error);
      
      // Manejo específico de errores del backend
      if (error?.code === 'MINT_NOT_ALLOWED_FOR_BUY') {
        notify("This token is not available for purchase.", "error");
        return;
      }
      
      if (error?.code === 'AMOUNT_TOO_SMALL' || error?.code === 'AMOUNT_TOO_LARGE') {
        notify(error?.message || "Invalid amount for this token.", "error");
        return;
      }
      
      if (error?.code === 'TOKEN_NOT_SUPPORTED') {
        notify("This token is not supported.", "error");
        return;
      }
      
      if (error?.code === 'BLINK_VALIDATION_FAILED') {
        notify("Transaction validation failed. Please try again.", "error");
        return;
      }
      
      // Manejo de errores de wallet y red
      if (isUserCancelled(error)) {
        notify("Signature cancelled in wallet.", "warning");
      } else if (error?.code === 'ACCOUNT_MISMATCH') {
        notify("Wallet mismatch. Try reconnecting your wallet.", "error");
      } else if (error?.message?.includes("timeout") || error?.name === "AbortError") {
        notify("Request timed out. Please try again.", "warning");
      } else if (error?.message?.includes('not allowed')) {
        notify("This action is not allowed.", "error");
      } else {
        notify(error?.message || "Couldn't complete purchase.", "warning");
      }
    } finally {
      setBusy(false);
    }
  }, [amount, selected, inlineCapable, adapter, connection, walletAddress, onClose, onBlinkShared, shareOnComplete]);

  useEffect(() => {
    if (!open) return;

    if (!presetToken) {
      setStep("pick-token");
      setSelected(null);
    }

    let matched = null;
    if (presetToken) {
      const match = tokens.find((t) => t.code === presetToken);
      if (match) {
        setSelected(match);
        setStep("pick-amount");
        matched = match;
      }
    }

    if (presetAmount !== null && presetAmount !== undefined) {
      const numeric = Number(presetAmount);
      if (Number.isFinite(numeric) && numeric > 0) {
        const normalized = Number(numeric.toFixed(6));
        setAmount(normalized);
        if (matched) setStep("pick-amount");
      }
    } else if (!presetToken) {
      setAmount(0.1);
    }
  }, [open, presetToken, presetAmount, tokens]);

  const modalFooter = step === "pick-amount"
    ? (
      <>
        <UiButton variant="ghost" onClick={() => onClose?.()} disabled={busy}>
          Close
        </UiButton>
        <UiButton variant="secondary" onClick={() => setStep("pick-token")} disabled={busy}>
          Back
        </UiButton>
        <UiButton 
          onClick={onBuyNow} 
          disabled={!proceedEnabled || busy}
          className="ui-action-card-primary"
        >
          {busy ? "Processing…" : `Buy ${selected?.code}`}
        </UiButton>
      </>
    )
    : (
      <UiButton variant="secondary" onClick={() => onClose?.()} disabled={busy}>
        Close
      </UiButton>
    );

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={undefined}
      title={null}
      labelledBy="buy-modal-heading"
      footer={modalFooter}
      modalProps={{ className: "buy-modal buy-modal--glass" }}
      overlayProps={{ className: "ui-modal-overlay buy-modal-overlay" }}
    >
      <div className="buy-modal-body">
        <header className="buy-modal-header">
          <div className="buy-modal-heading-group">
            <h2 id="buy-modal-heading" className="buy-modal-heading">Quick buy</h2>
            <p className="buy-modal-subheading">
              {step === "pick-amount"
                ? "Choose how much SOL you want to spend."
                : "Select a token to buy."}
            </p>
          </div>
        </header>

        {step === "pick-token" && (
          <>
            {/* Barra de búsqueda */}
            <div className="buy-search-container">
              <TokenSearch
                onTokenSelect={(token) => {
                  if (token.outputMint) {
                    pickToken(token);
                  }
                }}
                onTokenAdd={(newToken) => {
                  // Token añadido exitosamente, recargar lista
                  console.log('Token añadido:', newToken);
                  // Aquí podrías recargar los tokens o actualizar el estado
                }}
                availableTokens={tokens}
                className="buy-token-search"
              />
            </div>

            {tokensLoading ? (
              <div className="buy-loading">
                <p>Loading available tokens...</p>
              </div>
            ) : (
              <div className="buy-grid">
                {tokens.map((t) => {
                  const price = t.outputMint ? prices?.[t.outputMint]?.usdPrice : null;
                  return (
                    <TokenButton
                      key={t.code}
                      token={t}
                      price={price}
                      onClick={pickToken}
                      disabled={!t.outputMint}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === "pick-amount" && selected && (
          <>
            <div className="buy-selected-card" style={cardStyle}>
              <div className="buy-selected-card__header">
                <div className="buy-selected-card__identity">
                  <span className="buy-token-icon" aria-hidden style={selectedIconStyle}>
                    <span className="inner" style={selectedInnerStyle}>
                      <img
                        src={selectedMeta?.icon || `/tokens/${String(selected.code || '').toLowerCase()}.png`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/tokens/default.svg'; }}
                      />
                    </span>
                  </span>
                  <div className="buy-selected-card__titles">
                    <p className="buy-selected-card__code">{selected.code}</p>
                    <p className="buy-selected-card__label">{selected.label}</p>
                  </div>
                </div>
                <div className="buy-selected-card__quote">
                  <span className="buy-selected-card__quote-value">{quoteLabel}</span>
                  <span className="buy-selected-card__quote-caption">{quoteSubLabel}</span>
                </div>
              </div>

              <div className="buy-selected-card__stats">
                <div className="buy-selected-card__stat">
                  <span className="buy-selected-card__stat-label">Precio</span>
                  <span className="buy-selected-card__stat-value">{priceLabel || "—"}</span>
                </div>
                <div className={`buy-selected-card__stat${changeTone ? ` buy-selected-card__stat--${changeTone}` : ""}`}>
                  <span className="buy-selected-card__stat-label">24h</span>
                  <span className={`buy-selected-card__stat-value${changeTone ? ` buy-selected-card__stat-value--${changeTone}` : ""}`}>
                    {changeLabel || "—"}
                  </span>
                </div>
              </div>

              <div className="buy-selected-card__meta">
                <span>{priceSourceLabel}</span>
                {shortMint && (
                  <span
                    className="buy-selected-card__meta-mint"
                    title={selected.outputMint || ""}
                  >
                    CA {shortMint}
                  </span>
                )}
              </div>

              <p className="buy-selected-card__hint">
                Blinks are executed from your connected wallet. Choose how much SOL to spend.
              </p>
            </div>

            <div className="buy-amounts">
              {amountOptions.map((a) => (
                <UiChip
                  key={a}
                  as="button"
                  type="button"
                  selected={a === amount}
                  className="buy-chip"
                  onClick={() => setAmount(a)}
                >
                  {a}
                </UiChip>
              ))}
              <div className="buy-custom-amount">
                <input
                  type="number"
                  placeholder="Custom amount"
                  min="0.001"
                  step="0.001"
                  value={amountOptions.includes(amount) ? "" : amount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value > 0) {
                      setAmount(value);
                    }
                  }}
                  className="buy-custom-input"
                />
              </div>
              </div>
            </>
          )}
      </div>
    </ModalShell>
  );
}

BuyTokenModal.propTypes = {
  open: PropTypes.bool,
  presetToken: PropTypes.string,
  presetAmount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  shareOnComplete: PropTypes.bool,
  onClose: PropTypes.func,
  onBlinkShared: PropTypes.func,
};

BuyTokenModal.defaultProps = {
  open: false,
  presetToken: null,
  presetAmount: null,
  shareOnComplete: true,
  onClose: undefined,
  onBlinkShared: undefined,
};
