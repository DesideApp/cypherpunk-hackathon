import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
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
import SettlementModal from "./modals/SettlementModal.jsx";
import "./AgreementCard.css";

const AGREEMENT_STATUSES = {
  PENDING_B: "pending_b",
  PENDING_A: "pending_a",
  SIGNED_BOTH: "signed_both",
  EXPIRED: "expired",
};

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
  } catch (err) {
    return Transaction.from(raw);
  }
}

function AgreementCard({ msg }) {
  const { pubkey: myWallet } = useAuthManager();
  const { connection } = useRpc();
  const walletCtx = useWallet();
  const debug = useMemo(() => createDebugLogger("agreement", { envKey: "VITE_DEBUG_AGREEMENT_LOGS" }), []);
  const adapter = walletCtx?.adapter;
  const walletPk = walletCtx?.publicKey?.toBase58?.() || walletCtx?.publicKey || myWallet;

  const agreement = msg?.agreement || {};
  const receipt = msg?.receipt || {};
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

  const convId = msg?.convId;
  const clientId = msg?.clientId || msg?.id;

  const applyReceiptUpdate = (nextReceipt) => {
    actions.upsertMessage?.(convId, {
      clientId,
      receipt: {
        ...receipt,
        ...nextReceipt,
      },
    });
  };

  const sendThroughWallet = async (serializedTx) => {
    if (!adapter) throw new Error("Wallet not connected");
    const tx = deserializeTransaction(serializedTx);

    if (typeof adapter.sendTransaction === "function") {
      return adapter.sendTransaction(tx, connection, { preflightCommitment: "confirmed" });
    }

    if (typeof adapter.signTransaction === "function") {
      const signed = await adapter.signTransaction(tx);
      const raw = signed.serialize();
      return connection.sendRawTransaction(raw, { skipPreflight: false });
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
        throw new Error(prepare?.message || "No se pudo preparar la firma");
      }

      const requiresWallet = !!prepare?.transaction;
      let signature = null;

      if (requiresWallet) {
        notify("Opening your wallet…", "info");
        signature = await sendThroughWallet(prepare.transaction);
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

      applyReceiptUpdate(nextReceipt);
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

  const handleSettle = () => {
    if (!amount || !token || !payee) return;
    setSettling(true);
    openBlink(() => buildTransfer({ token, to: payee, amount }));
    setSettling(false);
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
      notify(error?.message || "No se pudo descargar el acuerdo.", "error");
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
      notify(error?.message || "No se pudo verificar el acuerdo.", "error");
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
      applyReceiptUpdate({
        settlement: {
          status: 'settled',
          txSig: outcomeSig,
        },
      });
      notify("Pago registrado.", "success");
      setSettlementModalOpen(false);
    } catch (error) {
      notify(error?.message || "No se pudo registrar el pago.", "error");
    } finally {
      setSavingSettlement(false);
    }
  };

  const statusLabel = {
    [AGREEMENT_STATUSES.PENDING_B]: `Sent to ${counterpartyLabel}`,
    [AGREEMENT_STATUSES.PENDING_A]: `Signed by ${counterpartyLabel}`,
    [AGREEMENT_STATUSES.SIGNED_BOTH]: 'Signed by both',
    [AGREEMENT_STATUSES.EXPIRED]: 'Agreement expired',
  }[status];

  return (
    <div className="agreement-card" role="group" aria-label="On-chain agreement">
      <header className="agreement-card-header">
        <div>
          <p className="agreement-card-status">{statusLabel}</p>
          <h3 className="agreement-card-title">{agreement.title || 'Agreement'}</h3>
        </div>
        {hash && <span className="agreement-card-hash">{hash.slice(0, 8)}…</span>}
      </header>

      {agreement.body && <p className="agreement-card-body">{agreement.body}</p>}

      {displayAmount && (
        <div className="agreement-card-amount">
          <span>{displayAmount}</span>
          <span>{payerLabel} → {payeeLabel}</span>
        </div>
      )}

      {deadlineLabel && status !== AGREEMENT_STATUSES.EXPIRED && (
        <p className="agreement-card-deadline">Deadline: {deadlineLabel}</p>
      )}

      <div className="agreement-card-actions">
        {needsMySignature && (
          <button
            type="button"
            className="agreement-primary"
            onClick={handleSign}
            disabled={signing}
          >
            {signing ? "Signing…" : "Sign in my wallet"}
          </button>
        )}

        {status === AGREEMENT_STATUSES.PENDING_A && txSigB && (
          <a
            className="agreement-link"
            href={explorerB}
            target="_blank"
            rel="noreferrer"
          >
            View transaction (B)
          </a>
        )}

        {status === AGREEMENT_STATUSES.SIGNED_BOTH && txSigA && (
          <div className="agreement-links">
            {txSigB && (
              <a className="agreement-link" href={explorerB} target="_blank" rel="noreferrer">View tx (B)</a>
            )}
            <a className="agreement-link" href={explorerA} target="_blank" rel="noreferrer">View tx (A)</a>
          </div>
        )}

        {status === AGREEMENT_STATUSES.EXPIRED && (
          <p className="agreement-card-expired">The agreement has expired.</p>
        )}

        {enableVerify && status === AGREEMENT_STATUSES.SIGNED_BOTH && isParticipant && (
          <button
            type="button"
            className="agreement-secondary"
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? "Verifying…" : "Verify"}
          </button>
        )}

        {isSettled && settlementSig && (
          <span className="agreement-card-settled">
            Settled · <a href={settlementExplorer} target="_blank" rel="noreferrer">view tx</a>
          </span>
        )}
      </div>

      <div className="agreement-card-footer">
        {canSettle && isPayer && (
          <button
            type="button"
            className="agreement-primary"
            onClick={handleSettle}
            disabled={settling}
          >
            {settling ? "Opening…" : "Pay now"}
          </button>
        )}

        {canSettle && isPayee && (
          <button
            type="button"
            className="agreement-secondary"
            onClick={handleRequestSettle}
            disabled={settling}
          >
            {settling ? "Opening…" : "Request payment"}
          </button>
        )}

        {enableSettlementAttachment && status === AGREEMENT_STATUSES.SIGNED_BOTH && !isSettled && isParticipant && (
          <button
            type="button"
            className="agreement-secondary"
            onClick={() => setSettlementModalOpen(true)}
            disabled={savingSettlement}
          >
            Attach transaction
          </button>
        )}

        <button type="button" className="agreement-secondary agreement-download" onClick={handleDownload}>
          Download
        </button>
      </div>

      {enableSettlementAttachment && (
        <SettlementModal
          open={settlementModalOpen}
          onClose={() => setSettlementModalOpen(false)}
          onSubmit={handleSettlementSubmit}
          loading={savingSettlement}
        />
      )}
    </div>
  );
}

AgreementCard.propTypes = {
  msg: PropTypes.object.isRequired,
};

export default AgreementCard;
