import React, { useMemo, useState, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useRpc } from "@wallet-adapter/core/contexts/RpcProvider";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { notify } from "@shared/services/notificationService.js";
import { FEATURES, SOLANA } from "@shared/config/env.js";
import { listBuyTokens } from "@features/messaging/config/buyTokens.js";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { getAllowedTokens } from "@features/messaging/services/allowedTokensService.js";
import { executeBuyBlink } from "@features/messaging/services/buyBlinkService.js";
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

export default function BuyTokenModal({ open = false, onClose }) {
  const { pubkey: myWallet } = useAuthManager();
  const walletCtx = useWallet();
  const { connection } = useRpc();
  const adapter = walletCtx?.adapter || null;

  const [backendTokens, setBackendTokens] = useState(null);
  const [tokensLoading, setTokensLoading] = useState(false);

  // Cargar tokens desde el backend
  useEffect(() => {
    if (!open) return;
    
    const loadTokens = async () => {
      setTokensLoading(true);
      try {
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
    if (backendTokens?.tokens) {
      const backendTokensList = backendTokens.tokens.map((token) => {
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

    return fallbackTokens;
  }, [backendTokens, fallbackLookup, fallbackTokens]);
  const [step, setStep] = useState("pick-token");
  const [selected, setSelected] = useState(null); // { code, outputMint }
  const [amount, setAmount] = useState(0.1);
  const [busy, setBusy] = useState(false);

  const amountOptions = [0.1, 0.5, 1];
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
  }, [amount, selected, inlineCapable, adapter, connection, walletAddress, onClose]);

  if (!open) return null;

  return (
    <div className="buy-modal-overlay" role="presentation">
      <div className="buy-modal" role="dialog" aria-modal="true" aria-labelledby="buy-title">
        <header className="buy-modal-header">
          <h2 id="buy-title">Buy tokens</h2>
          <button type="button" className="chat-action-close" onClick={() => onClose?.()} aria-label="Close">×</button>
        </header>

        <div className="buy-modal-body">
          {step === "pick-token" && (
            <>
              <p>Select a token to buy.</p>
              {tokensLoading ? (
                <div className="buy-loading">
                  <p>Loading available tokens...</p>
                </div>
              ) : (
                <div className="buy-grid">
                  {tokens.map((t) => (
                    <button
                      key={t.code}
                      type="button"
                      className={`buy-token${t.outputMint ? "" : " disabled"}`}
                      onClick={() => pickToken(t)}
                      disabled={!t.outputMint}
                      title={t.outputMint ? `Buy ${t.label}` : "Token not configured"}
                    >
                      <span className="buy-token-code">{t.code}</span>
                      <span className="buy-token-name">{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "pick-amount" && selected && (
            <>
              <p>Choose amount in SOL (spent as WSOL).</p>
              <div className="buy-amounts">
                {amountOptions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`buy-chip${a === amount ? " active" : ""}`}
                    onClick={() => setAmount(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <footer className="buy-modal-footer">
          {step === "pick-amount" ? (
            <>
              <button type="button" className="buy-secondary" onClick={() => setStep("pick-token")}>Back</button>
              <button type="button" className="buy-primary" onClick={onBuyNow} disabled={!proceedEnabled || busy}>
                {busy ? "Processing…" : `Buy ${selected?.code}`}
              </button>
            </>
          ) : (
            <button type="button" className="buy-secondary" onClick={() => onClose?.()}>Close</button>
          )}
        </footer>
      </div>
    </div>
  );
}

BuyTokenModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};
