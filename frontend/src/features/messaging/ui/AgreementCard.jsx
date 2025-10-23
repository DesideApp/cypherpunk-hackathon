import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { VersionedTransaction, Transaction, TransactionInstruction, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useRpc } from "@wallet-adapter/core/contexts/RpcProvider";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { notify } from "@shared/services/notificationService.js";
import { createDebugLogger } from "@shared/utils/debug.js";
import {
  confirmAgreementSignature,
  prepareAgreementSignature,
  verifyAgreement,
  markAgreementSettled,
} from "@features/messaging/services/agreementService.js";
import { buildTransfer, buildRequest } from "@features/messaging/actions/blinkUrlBuilder.js";
import { assertAllowed } from "@features/messaging/config/blinkSecurity.js";
import { formatAmountForDisplay } from "@shared/tokens/tokens.js";
import { actions } from "@features/messaging/store/messagesStore.js";
import { IS_DEMO, FEATURES } from "@shared/config/env.js";
import { executeBlink } from "@features/messaging/services/blinkExecutionService.js";
import ActionCardBase from "@shared/ui/bubbles/ActionCardBase.jsx";
import SettlementModal from "./modals/SettlementModal.jsx";
import "./AgreementCard.css";

const AGREEMENT_STATUSES = {
  PENDING_B: "pending_b",
  PENDING_A: "pending_a",
  SIGNED_BOTH: "signed_both",
  EXPIRED: "expired",
};

const EMPTY_OBJECT = Object.freeze({});

function getExplorerUrl(signature) {
  if (!signature) return null;
  const base = "https://explorer.solana.com/tx/";
  const suffix = IS_DEMO ? "?cluster=devnet" : "";
  return `${base}${signature}${suffix}`;
}

function deserializeTransaction(base64) {
  const raw = Buffer.from(base64, "base64");
  try {
    return VersionedTransaction.deserialize(raw);
  } catch (_err) {
    return Transaction.from(raw);
  }
}

function AgreementCard({ msg, direction = "received" }) {
  const { pubkey: myWallet } = useAuthManager();
  const { connection } = useRpc();
  const walletCtx = useWallet();
  const debug = useMemo(() => createDebugLogger("agreement", { envKey: "VITE_DEBUG_AGREEMENT_LOGS" }), []);
  const adapter = walletCtx?.adapter;
  const walletPk = walletCtx?.publicKey?.toBase58?.() || walletCtx?.publicKey || myWallet;

  const [agreementState, setAgreementState] = useState(() =>
    msg?.agreement && typeof msg.agreement === "object" ? msg.agreement : null
  );
  const [receiptState, setReceiptState] = useState(() =>
    msg?.receipt && typeof msg.receipt === "object" ? msg.receipt : null
  );
  const agreementPropRef = useRef(msg?.agreement);
  const receiptPropRef = useRef(msg?.receipt);

  useEffect(() => {
    if (msg?.agreement !== agreementPropRef.current) {
      agreementPropRef.current = msg?.agreement;
      setAgreementState(msg?.agreement && typeof msg.agreement === "object" ? msg.agreement : null);
    }
  }, [msg?.agreement]);

  useEffect(() => {
    if (msg?.receipt !== receiptPropRef.current) {
      receiptPropRef.current = msg?.receipt;
      setReceiptState(msg?.receipt && typeof msg.receipt === "object" ? msg.receipt : null);
    }
  }, [msg?.receipt]);

  const agreement = agreementState || EMPTY_OBJECT;
  const receipt = receiptState || EMPTY_OBJECT;

  const participants = Array.isArray(agreement.participants) ? agreement.participants : [];
  const creator = agreement.createdBy || participants[0];
  const counterparty = participants.find((p) => p && p !== creator);
  const payer = agreement.payer || null;
  const payee = agreement.payee || null;
  const amount = agreement.amount || null;
  const token = agreement.token || null;
  const deadline = agreement.deadline ? new Date(agreement.deadline) : null;

  const statusRaw = receipt.status || AGREEMENT_STATUSES.PENDING_B;
  const isExpired = deadline && deadline.getTime() < Date.now() && statusRaw !== AGREEMENT_STATUSES.SIGNED_BOTH;
  const status = isExpired ? AGREEMENT_STATUSES.EXPIRED : statusRaw;

  const hash = receipt.hash || null;
  const txSigB = receipt.txSigB || null;
  const txSigA = receipt.txSigA || null;
  const settlement = receipt.settlement || null;
  const isSettled = settlement?.status === 'settled';
  const settlementSig = settlement?.txSig || null;

  const isCreator = myWallet && creator === myWallet;
  const isCounterparty = myWallet && counterparty === myWallet;
  const isPayer = myWallet && payer === myWallet;
  const isPayee = myWallet && payee === myWallet;
  const isParticipant = myWallet && participants.includes(myWallet);

  const needsMySignature =
    (status === AGREEMENT_STATUSES.PENDING_B && isCounterparty) ||
    (status === AGREEMENT_STATUSES.PENDING_A && isCreator);

  const canSettle =
    status === AGREEMENT_STATUSES.SIGNED_BOTH &&
    amount &&
    token &&
    (isPayer || isPayee);
  const enableVerify = FEATURES.AGREEMENT_VERIFY;
  const enableSettlementAttachment = FEATURES.AGREEMENT_SETTLEMENT;

  const variant = direction === "sent" ? "own" : "contact";

  const [signing, setSigning] = useState(false);
  const [settling, setSettling] = useState(false);
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);

  const explorerB = getExplorerUrl(txSigB);
  const explorerA = getExplorerUrl(txSigA);
  const settlementExplorer = getExplorerUrl(settlementSig);

  const displayAmount = amount && token ? formatAmountForDisplay(token, amount) : null;

  const short = (value) => (value ? `${value.slice(0, 4)}...${value.slice(-4)}` : "");
  const payerLabel = short(payer);
  const payeeLabel = short(payee);
  const counterpartyLabel = short(counterparty) || "contact";

  const deadlineLabel = deadline ? deadline.toLocaleString() : null;
  const createdAtRaw = agreement?.createdAt || msg?.timestamp || null;
  const createdLabel = useMemo(() => {
    if (!createdAtRaw) return null;
    const date = new Date(createdAtRaw);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [createdAtRaw]);

  const convId = msg?.convId || agreement?.conversationId || agreement?.convId || null;
  const existingClientId = msg?.clientId || msg?.clientMsgId || msg?.meta?.clientId || msg?.meta?.messageId || null;
  const messageId =
    msg?.id ||
    msg?.serverId ||
    msg?.meta?.messageId ||
    msg?.meta?.clientId ||
    agreement?.id ||
    null;

  const applyReceiptUpdate = (nextReceipt, nextAgreement = null) => {
    const mergedReceipt = { ...receipt, ...nextReceipt };
    const mergedAgreement = nextAgreement ? nextAgreement : agreementState || EMPTY_OBJECT;

    setReceiptState(mergedReceipt);
    if (nextAgreement) setAgreementState(mergedAgreement);

    console.debug('[AgreementCard] applyReceiptUpdate', {
      convId,
      existingClientId,
      messageId,
      hasConv: !!convId,
      hasClient: !!existingClientId,
      hasMessage: !!messageId,
      msgMeta: msg?.meta,
    });

    if (convId && (existingClientId || messageId)) {
      const payload = {
        receipt: mergedReceipt,
        ...(nextAgreement ? { agreement: mergedAgreement } : {}),
        meta: {
          agreementId: mergedAgreement?.id || agreement?.id || msg?.meta?.agreementId || null,
          clientId: existingClientId || messageId,
          messageId: messageId,
          kind: 'agreement',
          convId,
          role: msg?.meta?.role || null,
          status: mergedReceipt?.status || msg?.meta?.status || null,
        },
      };
      if (existingClientId) payload.clientId = existingClientId;
      if (messageId) payload.id = messageId;
      actions.upsertMessage?.(convId, payload);
    }

    return { mergedReceipt, mergedAgreement };
  };

  const broadcastAgreementUpdate = (nextReceipt, nextAgreement = null) => {
    if (convId && (existingClientId || messageId)) {
      window.dispatchEvent(new CustomEvent('chat:agreement:update', {
        detail: {
          convId,
          clientId: existingClientId || null,
          messageId,
          agreement: nextAgreement || agreement,
          receipt: nextReceipt,
        },
      }));
    }
  };

  const sendThroughWallet = async (serializedTx) => {
    if (!adapter) throw new Error("Wallet not connected");
    const tx = deserializeTransaction(serializedTx);

    if (typeof adapter.signTransaction === "function") {
      const signed = await adapter.signTransaction(tx);
      const raw = signed.serialize();
      return connection.sendRawTransaction(raw, { skipPreflight: false });
    }

    if (typeof adapter.sendTransaction === "function") {
      return adapter.sendTransaction(tx, connection, { preflightCommitment: "confirmed" });
    }

    throw new Error("Wallet adapter does not support sending transactions");
  };

  const handleSign = async () => {
    if (!agreement?.id) return;
    if (!walletPk || !isParticipant) {
      notify("Connect your wallet before signing.", "warning");
      return;
    }

    try {
      setSigning(true);
      const prepare = await prepareAgreementSignature(agreement.id, { signer: walletPk });
      if (prepare?.error) {
        throw new Error(prepare?.message || "Unable to prepare agreement signature.");
      }

      const requiresWallet = !!prepare?.transaction;
      let signature = null;

      if (requiresWallet) {
        notify("Opening your wallet…", "info");
        let serializedTx = prepare.transaction;
        if (prepare?.memo && adapter?.signTransaction && connection) {
          try {
            const memoInstruction = new TransactionInstruction({
              programId: MEMO_PROGRAM_ID,
              keys: [
                {
                  pubkey: new PublicKey(walletPk),
                  isSigner: true,
                  isWritable: false,
                },
              ],
              data: Buffer.from(prepare.memo, "utf8"),
            });
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            const localTx = new Transaction({ feePayer: new PublicKey(walletPk), recentBlockhash: blockhash });
            localTx.add(memoInstruction);
            const signedTx = await adapter.signTransaction(localTx);
            const raw = signedTx.serialize();
            const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
            const confirmation = await connection.confirmTransaction(
              { signature: sig, blockhash, lastValidBlockHeight },
              "confirmed"
            );
            if (!confirmation?.value || confirmation.value.err) {
              throw new Error("settlement-tx-not-confirmed");
            }
            signature = sig;
          } catch (rebuildError) {
            debug("sign-rebuild-fallback", { error: rebuildError?.message });
            signature = await sendThroughWallet(serializedTx);
            const confirmation = await connection.confirmTransaction(signature, "confirmed");
            if (!confirmation?.value || confirmation.value.err) {
              throw new Error("wallet-tx-not-confirmed");
            }
          }
        } else {
          signature = await sendThroughWallet(serializedTx);
          const confirmation = await connection.confirmTransaction(signature, "confirmed");
          if (!confirmation?.value || confirmation.value.err) {
            throw new Error("wallet-tx-not-confirmed");
          }
        }
      } else {
        signature = prepare?.payload?.hash
          ? `ack-${prepare.payload.hash}`
          : `ack-${Date.now()}`;
      }
      debug('signed', { agreementId: agreement.id, signature, offchain: !requiresWallet });

      const confirm = await confirmAgreementSignature(agreement.id, {
        signerPubkey: walletPk,
        txSig: signature,
      });

      const nextReceipt = confirm?.receipt || {
        status: confirm?.status || (status === AGREEMENT_STATUSES.PENDING_B ? AGREEMENT_STATUSES.PENDING_A : AGREEMENT_STATUSES.SIGNED_BOTH),
        txSigB: confirm?.txSigB || (status === AGREEMENT_STATUSES.PENDING_B ? signature : txSigB),
        txSigA: confirm?.txSigA || (status === AGREEMENT_STATUSES.PENDING_A ? signature : txSigA),
        hash,
      };

      const updatedAgreement = confirm?.agreement
        ? { ...agreement, ...confirm.agreement }
        : agreement;

      const { mergedReceipt, mergedAgreement } = applyReceiptUpdate(nextReceipt, updatedAgreement);
      notify(requiresWallet ? "Agreement signed." : "Agreement accepted.", "success");
    } catch (error) {
      debug('sign-error', { message: error?.message });
      if (error?.message?.toLowerCase().includes('reject')) {
        notify("Signature cancelled in wallet.", "warning");
      } else {
        notify(error?.message || "Unable to sign the agreement.", "error");
      }
    } finally {
      setSigning(false);
    }
  };

  const openBlink = (builder) => {
    try {
      const result = builder();
      assertAllowed(result.actionUrl, { feature: 'agreement-settle' });
      window.open(result.dialToUrl, "_blank", "noopener,noreferrer");
      notify("Opening your wallet…", "info");
    } catch (error) {
      if (error?.message?.toLowerCase().includes('not allowed')) {
        notify("This action link is not allowed.", "error");
      } else {
        notify(error?.message || "Unable to open the Blink link.", "error");
      }
    }
  };

  const inlineEnabled = FEATURES.PAYMENT_INLINE_EXEC;
  const inlineCapable = inlineEnabled && adapter && connection && isPayer && !!token && !!amount;

  const executeSettlementInline = async (builder) => {
    const blink = builder();
    assertAllowed(blink.actionUrl, { feature: "agreement-settle" });

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

    notify("Opening your wallet…", "info");
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 15000) : null;

    try {
      const payload = await executeBlink(blink.actionUrl, walletPk, { signal: controller?.signal });
      const signatures = [];
      if (payload?.type === "transaction" && typeof payload.transaction === "string") {
        signatures.push(await executeTransaction(payload.transaction));
      } else if (payload?.type === "transactions" && Array.isArray(payload.transactions)) {
        for (const serialized of payload.transactions) {
          if (typeof serialized !== "string") continue;
          signatures.push(await executeTransaction(serialized));
        }
      } else {
        throw new Error("Unexpected response from settlement action.");
      }

      const primarySig = signatures[signatures.length - 1] || signatures[0] || null;
      if (!primarySig) {
        notify("Payment sent, but signature is missing.", "warning");
        return null;
      }
      return primarySig;
    } catch (error) {
      if (error?.name === "AbortError") {
        notify("Settlement request timed out. Opening Dialect…", "warning");
        openBlink(() => blink);
        return null;
      }
      if (error?.message?.toLowerCase().includes("reject") || error?.code === 4001) {
        notify("Signature cancelled in wallet.", "warning");
      } else {
        notify(error?.message || "Couldn't complete settlement. Opening Dialect…", "warning");
        openBlink(() => blink);
      }
      return null;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };

  const handleSettle = async () => {
    if (!amount || !token || !payee) return;
    setSettling(true);
    try {
      let signature = null;
      if (inlineCapable) {
        signature = await executeSettlementInline(() => buildTransfer({ token, to: payee, amount }));
      } else {
        openBlink(() => buildTransfer({ token, to: payee, amount }));
      }
      if (signature) {
        try {
          const res = await markAgreementSettled(agreement.id, { txSig: signature });
          const settlementUpdate = {
            settlement: {
              status: 'settled',
              txSig: res?.txSig || signature,
              recordedAt: res?.settlement?.recordedAt || new Date().toISOString(),
            },
          };
          const { mergedReceipt } = applyReceiptUpdate(settlementUpdate);
          broadcastAgreementUpdate(mergedReceipt);
          notify("Payment recorded.", "success");
        } catch (error) {
          notify(error?.message || "Failed to register payment.", "error");
        }
      }
    } finally {
      setSettling(false);
    }
  };

  const handleRequestSettle = () => {
    if (!amount || !token || !myWallet) return;
    setSettling(true);
    openBlink(() => buildRequest({ token, to: myWallet, amount }));
    setSettling(false);
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([JSON.stringify(agreement, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `agreement-${agreement.id || 'detalle'}.json`;
      anchor.rel = 'noopener';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify(error?.message || "Unable to download agreement.", "error");
    }
  };

  const handleVerify = async () => {
    if (!agreement?.id) return;
    if (!txSigA || !txSigB) {
      notify("Both signatures are required before verification.", "warning");
      return;
    }
    setVerifying(true);
    debug('verify:start', { agreementId: agreement.id });
    try {
      const res = await verifyAgreement(agreement.id);
      const ok = res?.ok !== false;
      debug('verify:result', { agreementId: agreement.id, ok });
      if (ok) {
        notify("Verified: the transactions contain the agreement proof.", "success");
      } else {
        notify("Not verified: the transaction does not contain the expected proof.", "warning");
      }
    } catch (error) {
      notify(error?.message || "Unable to verify agreement proof.", "error");
    } finally {
      setVerifying(false);
    }
  };

  const handleSettlementSubmit = async (txSig) => {
    if (!agreement?.id) return;
    setSavingSettlement(true);
    debug('settlement:submit', { agreementId: agreement.id, txSig });
    try {
      const res = await markAgreementSettled(agreement.id, { txSig });
      const outcomeSig = res?.txSig || txSig;
      const settlementUpdate = {
        settlement: {
          status: 'settled',
          txSig: outcomeSig,
        },
      };
      const { mergedReceipt } = applyReceiptUpdate(settlementUpdate);
      broadcastAgreementUpdate(mergedReceipt);
      notify("Settlement recorded.", "success");
      setSettlementModalOpen(false);
    } catch (error) {
      notify(error?.message || "Unable to record settlement.", "error");
    } finally {
      setSavingSettlement(false);
    }
  };

  const metaRows = useMemo(() => {
    const rows = [];
    if (payerLabel) {
      rows.push({ id: "from", label: "From", value: payerLabel });
    }
    if (payeeLabel) {
      rows.push({ id: "to", label: "To", value: payeeLabel });
    }
    if (displayAmount) {
      rows.push({ id: "amount", label: "Amount", value: displayAmount });
    }
    const tokenLabel =
      token?.symbol || token?.code || token?.ticker || token?.name || token?.mint || null;
    if (tokenLabel && (!displayAmount || !String(displayAmount).includes(tokenLabel))) {
      rows.push({ id: "token", label: "Token", value: tokenLabel });
    }
    if (deadlineLabel) {
      rows.push({ id: "deadline", label: "Deadline", value: deadlineLabel });
    }
    if (hash) {
      rows.push({ id: "agreement-hash", label: "Agreement", value: `${hash.slice(0, 8)}…` });
    }
    return rows;
  }, [payerLabel, payeeLabel, displayAmount, token, deadlineLabel, hash]);

  const bodyContent = (
    <>
      <div className="agreement-card__header">
        <h3 className="agreement-card__title">
          {agreement.title || "Agreement"}
        </h3>
      </div>

      {agreement.body && (
        <p className="bubble-action-card__note bubble-action-card__note--multiline">
          {agreement.body}
        </p>
      )}

      {displayAmount && (
        <div className="bubble-action-card__amount">
          <span>{displayAmount}</span>
          <span className="bubble-action-card__amount-sub">
            {payerLabel || "—"} → {payeeLabel || "—"}
          </span>
        </div>
      )}

      {status === AGREEMENT_STATUSES.EXPIRED && (
        <p className="agreement-card-expired">The agreement has expired.</p>
      )}
    </>
  );

  const actionButtons = (
    <div className="bubble-action-card__button-group">
      {needsMySignature && (
        <button
          type="button"
          className="bubble-action-card__button bubble-action-card__button--primary"
          onClick={handleSign}
          disabled={signing}
        >
          {signing ? "Signing…" : "Sign in my wallet"}
        </button>
      )}

      {status === AGREEMENT_STATUSES.PENDING_A && txSigB && (
        <a
          className="bubble-action-card__button bubble-action-card__button--secondary bubble-action-card__button--link"
          href={explorerB}
          target="_blank"
          rel="noreferrer"
        >
          View tx (B)
        </a>
      )}

      {status === AGREEMENT_STATUSES.SIGNED_BOTH && txSigA && (
        <div className="agreement-links">
          {txSigB && (
            <a
              className="bubble-action-card__button bubble-action-card__button--secondary bubble-action-card__button--link"
              href={explorerB}
              target="_blank"
              rel="noreferrer"
            >
              View tx (B)
            </a>
          )}
          <a
            className="bubble-action-card__button bubble-action-card__button--secondary bubble-action-card__button--link"
            href={explorerA}
            target="_blank"
            rel="noreferrer"
          >
            View tx (A)
          </a>
        </div>
      )}

      {enableVerify && status === AGREEMENT_STATUSES.SIGNED_BOTH && isParticipant && (
        <button
          type="button"
          className="bubble-action-card__button bubble-action-card__button--secondary"
          onClick={handleVerify}
          disabled={verifying}
        >
          {verifying ? "Verifying…" : "Verify"}
        </button>
      )}

      {isSettled && settlementSig && (
        <span className="agreement-card-settled">
          Settled ·{" "}
          <a href={settlementExplorer} target="_blank" rel="noreferrer">
            view tx
          </a>
        </span>
      )}
    </div>
  );

  const footerButtons = (
    <div className="bubble-action-card__button-group agreement-card-footer">
      {canSettle && isPayer && (
        <button
          type="button"
          className="bubble-action-card__button bubble-action-card__button--primary"
          onClick={handleSettle}
          disabled={settling}
        >
          {settling ? "Opening…" : "Pay now"}
        </button>
      )}

      {canSettle && isPayee && (
        <button
          type="button"
          className="bubble-action-card__button bubble-action-card__button--secondary"
          onClick={handleRequestSettle}
          disabled={settling}
        >
          {settling ? "Opening…" : "Request payment"}
        </button>
      )}

      {enableSettlementAttachment &&
        status === AGREEMENT_STATUSES.SIGNED_BOTH &&
        !isSettled &&
        isParticipant && (
          <button
            type="button"
            className="bubble-action-card__button bubble-action-card__button--secondary"
            onClick={() => setSettlementModalOpen(true)}
            disabled={savingSettlement}
          >
            Attach transaction
          </button>
        )}

      <button
        type="button"
        className="bubble-action-card__button bubble-action-card__button--secondary agreement-download"
        onClick={handleDownload}
      >
        Download
      </button>
    </div>
  );

  return (
    <>
      <ActionCardBase
        variant={variant}
        title="Agreement"
        metaRows={metaRows}
        body={bodyContent}
        footer={
          <>
            {actionButtons}
            {footerButtons}
          </>
        }
        className="agreement-card"
        metaClassName="agreement-card-meta"
        ariaLabel="On-chain agreement"
      />

      {enableSettlementAttachment && (
        <SettlementModal
          open={settlementModalOpen}
          onClose={() => setSettlementModalOpen(false)}
          onSubmit={handleSettlementSubmit}
          loading={savingSettlement}
        />
      )}
    </>
  );
}

AgreementCard.propTypes = {
  msg: PropTypes.object.isRequired,
  direction: PropTypes.string,
};

export default AgreementCard;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
