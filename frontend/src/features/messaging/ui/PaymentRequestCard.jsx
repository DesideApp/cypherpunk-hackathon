import React, { useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useRpc } from "@wallet-adapter/core/contexts/RpcProvider";
import { assertAllowed } from "@features/messaging/config/blinkSecurity.js";
import { notify } from "@shared/services/notificationService.js";
import { formatAmountForDisplay } from "@shared/tokens/tokens.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { actions } from "@features/messaging/store/messagesStore.js";
import { executeBlink } from "@features/messaging/services/blinkExecutionService.js";
import { FEATURES, IS_DEMO } from "@shared/config/env.js";
import ActionCardBase from "@shared/ui/bubbles/ActionCardBase.jsx";
import "./PaymentRequestCard.css";

function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function deserializeTransaction(base64) {
  const raw = Buffer.from(base64, "base64");
  try {
    return VersionedTransaction.deserialize(raw);
  } catch (_) {
    return Transaction.from(raw);
  }
}

function buildExplorerUrl(signature) {
  if (!signature) return null;
  const suffix = IS_DEMO ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}

function isUserCancelled(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("reject") || message.includes("cancel") || message.includes("decline") || error?.code === 4001;
}

function copyToClipboard(value) {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(() => {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      });
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    notify("Link copied to clipboard.", "success");
  } catch (_error) {
    notify("Unable to copy link.", "error");
  }
}

export default function PaymentRequestCard({ msg = {}, direction = "received" }) {
  const { pubkey: myWallet } = useAuthManager();
  const walletCtx = useWallet();
  const { connection } = useRpc();
  const adapter = walletCtx?.adapter || null;
  const request = msg?.paymentRequest || msg?.request || {};
  const amount = request.amount || null;
  const token = request.token || null;
  const payee = request.payee || null;
  const payer = request.payer || null;
  const dialToUrl = request.dialToUrl || request.dialtoUrl || null;
  const actionUrl = request.actionUrl || null;

  const createdAtRaw = request?.createdAt || null;
  const note = request.note || null;
  const displayAmount = amount && token ? formatAmountForDisplay(token, amount) : "";

  const [paying, setPaying] = useState(false);

  const receipt = useMemo(() => msg?.receipt || {}, [msg]);
  const paymentReceipt = receipt?.payment || null;
  const isPaid = paymentReceipt?.status === "paid";
  const paidSignature = paymentReceipt?.txSig || null;
  const explorerUrl = buildExplorerUrl(paidSignature);

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

  const payerAccount = walletAddress ? String(walletAddress).trim() : null;
  const isMine = direction === "sent";
  const payerMatches = payer && payerAccount && payer === payerAccount;
  const canPay = payerMatches && dialToUrl && !isPaid;
  const inlineEnabled = FEATURES.PAYMENT_INLINE_EXEC;
  const inlineCapable = inlineEnabled && adapter && connection && payerMatches && actionUrl;

  const titleText = "Payment request";

  const counterpartyShort = isMine
    ? payer
      ? shortAddress(payer)
      : "your contact"
    : shortAddress(payee);
  const subtitleText = isMine ? `to ${counterpartyShort}` : `from ${counterpartyShort}`;

  // Preferimos no repetir la pubkey completa si no hay nombre de contacto

  const infoNote = isPaid
    ? "Payment marked as completed."
    : isMine
      ? "Share the link with your contact or wait for their payment."
      : "You can pay directly from your wallet.";

  const createdAt = useMemo(() => {
    if (!createdAtRaw) return null;
    const date = new Date(createdAtRaw);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }, [createdAtRaw]);

  const createdLabel = useMemo(() => {
    if (!createdAt) return null;
    return createdAt.toLocaleString();
  }, [createdAt]);

  const handleOpenExternal = useCallback(
    ({ skipToast } = {}) => {
      if (!dialToUrl || !actionUrl) return;
      try {
        assertAllowed(actionUrl, { feature: "payment-request" });
        window.open(dialToUrl, "_blank", "noopener,noreferrer");
        if (!skipToast) {
          notify("Opening your wallet…", "info");
        }
      } catch (error) {
        const message = error?.message || "Unable to open payment link.";
        notify(message, message.includes("not allowed") ? "error" : "warning");
      }
    },
    [actionUrl, dialToUrl]
  );

  const handlePay = useCallback(async () => {
    if (isPaid) {
      notify("Payment already completed.", "info");
      return;
    }

    if (!dialToUrl || !actionUrl) {
      notify("Payment link not available.", "warning");
      return;
    }

    console.debug("[blink] pay-now", {
      inlineEnabled,
      inlineCapable,
      hasAdapter: !!adapter,
      hasConnection: !!connection,
      payerMatches,
      actionUrl,
    });

    if (!inlineCapable) {
      if (!adapter || !connection) {
        notify("Connect your wallet before paying.", "warning");
        return;
      }
      handleOpenExternal();
      return;
    }

    try {
      assertAllowed(actionUrl, { feature: "payment-request" });
    } catch (error) {
      const message = error?.message || "Payment link not allowed.";
      notify(message, message.includes("not allowed") ? "error" : "warning");
      return;
    }

    setPaying(true);
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 15000) : null;

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

      if (!signature) {
        throw new Error("Wallet did not return a signature.");
      }

      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    };

    try {
      notify("Opening your wallet…", "info");
      const payload = await executeBlink(actionUrl, payerAccount, { signal: controller?.signal });
      console.debug("[blink] execute response", payload);

      const signatures = [];
      if (payload?.type === "transaction" && typeof payload.transaction === "string") {
        const sig = await executeTransaction(payload.transaction);
        signatures.push(sig);
      } else if (payload?.type === "transactions" && Array.isArray(payload.transactions)) {
        for (const serialized of payload.transactions) {
          if (typeof serialized !== "string") continue;
          const sig = await executeTransaction(serialized);
          signatures.push(sig);
        }
      } else {
        throw new Error("Unexpected response from payment action.");
      }

      const primarySig = signatures[signatures.length - 1] || signatures[0] || null;
      if (primarySig) {
        const convId = msg?.convId;
        const clientId = msg?.clientId || msg?.clientMsgId || null;
        const serverId = msg?.id || msg?.serverId || null;
        const completedAt = new Date().toISOString();

        if (convId && (clientId || serverId)) {
          actions.upsertMessage?.(
            convId,
            {
              ...(clientId ? { clientId } : {}),
              ...(serverId ? { id: serverId } : {}),
              receipt: {
                ...receipt,
                payment: {
                  status: "paid",
                  txSig: primarySig,
                  completedAt,
                },
              },
            },
            payerAccount
          );
        }

        notify("Payment completed.", "success");
      } else {
        notify("Payment sent, but signature is missing.", "warning");
      }
    } catch (error) {
      console.error("[blink] inline payment failed", error);
      if (isUserCancelled(error)) {
        notify("Signature cancelled in wallet.", "warning");
      } else if (error?.name === "AbortError") {
        notify("Payment request timed out. Opening Dialect…", "warning");
        handleOpenExternal({ skipToast: true });
      } else {
        notify(error?.message || "Couldn't complete payment. Opening Dialect…", "warning");
        handleOpenExternal({ skipToast: true });
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      setPaying(false);
    }
  }, [
    actionUrl,
    adapter,
    connection,
    handleOpenExternal,
    inlineCapable,
    isPaid,
    dialToUrl,
    inlineEnabled,
    payerAccount,
    payerMatches,
    receipt,
    msg,
  ]);

  const variant = isMine ? "own" : "contact";

  const chipText = isPaid ? "PAID" : "REQUEST";

  const metaRows = useMemo(() => {
    const rows = [];
    if (displayAmount) {
      rows.push({
        id: "amount",
        label: "Amount",
        value: displayAmount,
      });
    }
    if (token) {
      rows.push({
        id: "token",
        label: "Token",
        value: token,
      });
    }
    const counterpart = isMine ? payer : payee;
    rows.push({
      id: "counterparty",
      label: isMine ? "Payer" : "Payee",
      value: counterpart ? shortAddress(counterpart) : "—",
    });
    if (isPaid && paidSignature && explorerUrl) {
      rows.push({
        id: "tx",
        label: "Tx",
        value: shortAddress(paidSignature),
        link: explorerUrl,
      });
    }
    return rows;
  }, [displayAmount, token, isMine, payer, payee, isPaid, paidSignature, explorerUrl]);

  const handleCopy = () => {
    if (!dialToUrl) {
      notify("Link not available.", "warning");
      return;
    }
    copyToClipboard(dialToUrl);
  };

  const primaryButtonLabel = paying
    ? "Processing…"
    : inlineCapable
      ? "Pay now"
      : "Open in wallet";

  const bodyContent = (
    <>
      {displayAmount && (
        <div className="bubble-action-card__amount">
          <span>{displayAmount}</span>
        </div>
      )}
      {note && <p className="bubble-action-card__note">Note: {note}</p>}
      <p className="bubble-action-card__note">{infoNote}</p>
    </>
  );

  const footerContent = (
    <div className="bubble-action-card__button-group">
      {!isPaid && !isMine && (
        <button
          type="button"
          className="bubble-action-card__button bubble-action-card__button--primary"
          onClick={handlePay}
          disabled={!canPay || paying}
        >
          {primaryButtonLabel}
        </button>
      )}
      {isPaid && explorerUrl && (
        <a
          className="bubble-action-card__button bubble-action-card__button--secondary bubble-action-card__button--link"
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
        >
          View tx
        </a>
      )}
      <button
        type="button"
        className="bubble-action-card__button bubble-action-card__button--secondary"
        onClick={handleCopy}
        disabled={!dialToUrl}
      >
        Copy link
      </button>
    </div>
  );

  return (
    <ActionCardBase
      variant={variant}
      title={titleText}
      metaRows={metaRows}
      body={bodyContent}
      footer={footerContent}
      className={isPaid ? "payment-card is-paid" : "payment-card"}
      ariaLabel={titleText}
    />
  );
}

PaymentRequestCard.propTypes = {
  msg: PropTypes.object,
};
