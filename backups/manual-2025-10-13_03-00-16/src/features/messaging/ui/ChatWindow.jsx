// src/features/messaging/ui/ChatWindow.jsx
import React, { useMemo, useCallback, useEffect, useState, useRef } from "react";
import ChatHeader from "./ChatHeader";
import WritingPanel from "./WritingPanel";
import ChatMessages from "./ChatMessages";
import ActionBar from "./ActionBar.jsx";

import useMessaging from "@features/messaging/hooks/useMessaging";
import { ENV, MESSAGING } from "@shared/config/env.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { useRtcDialer } from "@features/messaging/hooks/useRtcDialer.js";
import { base64ToUtf8 } from "@shared/utils/base64.js";
import { subscribe, getState, convId as canonicalConvId } from "@features/messaging/store/messagesStore.js";
import { buildTransfer, buildRequest } from "@features/messaging/actions/blinkUrlBuilder.js";
import {
  listSupportedTokens,
  validateAmount,
  isSupportedToken,
} from "@shared/tokens/tokens.js";
import { notify } from "@shared/services/notificationService.js";
import { createDebugLogger } from "@shared/utils/debug.js";
import "./ChatWindow.css";
import AgreementModal from "./modals/AgreementModal.jsx";
import BuyTokenModal from "./modals/BuyTokenModal.jsx";
import FundWalletModal from "./modals/FundWalletModal.jsx";

/* -------------------- helpers -------------------- */
function inferKindFromMime(mime = "") {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "binary";
}

function normalizeSelected(sel) {
  if (!sel) return { pubkey: null, nickname: null, avatar: null };
  if (typeof sel === "string") return { pubkey: sel, nickname: null, avatar: null };
  const key = sel.pubkey || sel.wallet || sel.id || null;
  return { pubkey: key, nickname: sel.nickname || sel.name || null, avatar: sel.avatar || null };
}

// Mapear mensaje genérico → shape UI (usa text/media; no 'payload')
function toUiMessage(m, myWallet) {
  if (!m) return null;

  // Sender
  const sender =
    m.sender ||
    (m.from ? (m.from === myWallet ? "me" : "other")
            : (m.author ? (m.author === myWallet ? "me" : "other")
                        : "other"));

  // Timestamps
  const timestamp =
    m.timestamp ||
    m.sentAt ||
    (m.createdAt ? (typeof m.createdAt === "string" ? Date.parse(m.createdAt) : m.createdAt) : Date.now());

  // Texto
  let text = m.text || m.body?.text || null;
  if (!text && m.box && !m.iv && !m.envelope && (!m.mime || m.mime === "text/plain")) {
    try { text = base64ToUtf8(m.box); } catch {}
  }
  if (!text && m.kind === "text" && typeof m.payload?.text === "string") {
    text = m.payload.text;
  }

  // Media
  let media = m.media || null;
  if (!media) {
    // a) inline (RTC)
    if ((m.kind === "media-inline" || m.kind === "media") && (m.base64 || m.payload?.base64)) {
      const mime = m.mime || m.payload?.mime || "application/octet-stream";
      media = {
        kind: inferKindFromMime(mime),
        base64: m.base64 || m.payload?.base64,
        mime,
        width: m.w || m.payload?.w,
        height: m.h || m.payload?.h,
        durationMs: m.durMs || m.payload?.durMs,
      };
    }
    // b) relay encolado
    else if (m.mime && m.box && (m.meta?.kind === "media" || inferKindFromMime(m.mime) !== "binary")) {
      media = {
        kind: inferKindFromMime(m.mime),
        base64: m.box,
        mime: m.mime,
        width: m.meta?.w,
        height: m.meta?.h,
        durationMs: m.meta?.durMs,
      };
    }
  }

  const deliveredAt = m.deliveredAt || null;
  const status = m.status || (deliveredAt ? "delivered" : "sent");

  const base = {
    id: m.id || m.serverId || m.clientId || undefined,
    sender,
    timestamp,
    deliveredAt,
    status,
    isEncrypted: !!(m.iv || m.envelope),
    isBackedUp: !!m.isBackedUp,
    via: m.via,
  };

  if (m.kind === 'agreement' || m.agreement) {
    return {
      ...base,
      kind: 'agreement',
      agreement: m.agreement || m.payload?.agreement || null,
      receipt: m.receipt || m.payload?.receipt || null,
    };
  }

  if (m.kind === 'payment-request' || m.paymentRequest || m.payload?.type === 'payment_request') {
    return {
      ...base,
      kind: 'payment-request',
      paymentRequest: m.paymentRequest || m.payload?.request || null,
    };
  }

  if (m.kind === 'payment-send' || m.paymentSend) {
    return {
      ...base,
      kind: 'payment-send',
      paymentSend: m.paymentSend,
    };
  }

  return {
    ...base,
    kind: m.kind || (media ? 'media' : 'text'),
    text: text || null,
    media: media || null,
  };
}

const MAX_REASON_LEN = 120;

/* ===================== Componente ===================== */

export default function ChatWindow({ selectedContact, activePanel, setActivePanel }) {
  const { pubkey: myWallet } = useAuthManager();
  const { closeRtc } = useRtcDialer();

  // Contacto activo
  const selected = useMemo(() => normalizeSelected(selectedContact), [selectedContact]);
  const peerWallet = selected.pubkey || null;
  const convId = useMemo(
    () => (peerWallet && myWallet ? canonicalConvId(myWallet, peerWallet) : null),
    [peerWallet, myWallet]
  );

  // Registro de wallet lo gestiona MessagingProvider (evita duplicar aquí)

  // Conversación activa: no gatear el typing por foco del DOM

  /* ---- Hook de mensajería ---- */
  const {
    messages: rawMessages,
    sendText,
    sendPaymentRequest,
    sendAgreement,
    setTyping,
    e2ee,
  } = useMessaging({
    selfWallet: myWallet,
    peerWallet,
    // Grado-1 E2EE: requiere clave fija en env, si no existe no se envía
    sharedKeyBase64: (ENV.E2E_SHARED_KEY_BASE64 || '').trim() || null,
  });

  // Debug explícito de resolución de clave (ayuda a diagnósticos)
  useEffect(() => {
    const rawEnv = (ENV.E2E_SHARED_KEY_BASE64 || '').trim();
    const resolved = rawEnv || null;
    try {
      console.debug('[E2EE] resolve', {
        from: resolved ? 'env' : 'missing',
        envLen: resolved ? resolved.length : 0,
      });
    } catch {}
  }, [peerWallet]);

  // Mapear a shape UI
  const messages = useMemo(
    () => (Array.isArray(rawMessages) ? rawMessages.map((m) => toUiMessage(m, myWallet)).filter(Boolean) : []),
    [rawMessages, myWallet]
  );

  const debugBlink = useMemo(
    () => createDebugLogger("blink", { envKey: "VITE_DEBUG_BLINK_LOGS" }),
    []
  );

  const supportedTokens = useMemo(() => listSupportedTokens(), []);
  const defaultToken = supportedTokens[0]?.code || "USDC";

  const [actionModal, setActionModal] = useState(null);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [fundModalOpen, setFundModalOpen] = useState(false);

  const peerLabel = useMemo(() => {
    const pk = selected?.pubkey;
    if (!pk) return "";
    if (selected?.nickname) return selected.nickname;
    return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
  }, [selected]);

  const selfLabel = useMemo(() => {
    if (!myWallet) return "";
    return `${myWallet.slice(0, 4)}...${myWallet.slice(-4)}`;
  }, [myWallet]);

  // Presencia/typing del peer (desde store global)
  const [peerOnline, setPeerOnline] = useState(() => {
    if (!peerWallet) return false;
    try {
      const snap = getState();
      return !!snap?.presence?.[peerWallet];
    } catch {
      return false;
    }
  });
  const [isTypingRemote, setIsTypingRemote] = useState(() => {
    if (!convId) return false;
    try {
      const snap = getState();
      return !!snap?.typing?.[convId];
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const snap = getState();
      setPeerOnline(peerWallet ? !!snap?.presence?.[peerWallet] : false);
      setIsTypingRemote(convId ? !!snap?.typing?.[convId] : false);
    } catch {}

    if (!peerWallet && !convId) return undefined;

    const off = subscribe((snap) => {
      try {
        setPeerOnline(peerWallet ? !!snap?.presence?.[peerWallet] : false);
        setIsTypingRemote(convId ? !!snap?.typing?.[convId] : false);
      } catch {}
    });
    return () => { try { off?.(); } catch {} };
  }, [peerWallet, convId]);

  const prevPeerRef = useRef(null);

  useEffect(() => {
    const previousPeer = prevPeerRef.current;
    prevPeerRef.current = peerWallet;

    return () => {
      if (previousPeer) {
        try { closeRtc?.(previousPeer); } catch {}
      }
    };
  }, [peerWallet, closeRtc]);

  const closeActionModal = useCallback(() => setActionModal(null), []);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail || {};
      const { kind } = detail;
      if (!kind) return;
      if (!peerWallet || !myWallet) {
        notify("Select a contact and connect your wallet before using actions.", "warning");
        return;
      }
      if (detail.peerWallet && detail.peerWallet !== peerWallet) return;
      if (detail.selfWallet && detail.selfWallet !== myWallet) return;

      if (kind === 'agreement') {
        if (!peerWallet || !myWallet) return;
        setAgreementModalOpen(true);
        return;
      }

      const presetToken = isSupportedToken(detail.token)
        ? String(detail.token).toUpperCase()
        : defaultToken;

      setActionModal({
        kind,
        token: presetToken,
        amount: detail.amount || "",
        reason: detail.reason || "",
      });
    };

    window.addEventListener("chat:action:open", handler);
    return () => window.removeEventListener("chat:action:open", handler);
  }, [peerWallet, myWallet, defaultToken]);

  useEffect(() => {
    if (!actionModal && !agreementModalOpen) return undefined;
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        if (agreementModalOpen) setAgreementModalOpen(false);
        else closeActionModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionModal, agreementModalOpen, closeActionModal]);

  const updateActionField = useCallback((key, value) => {
    setActionModal((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const submitActionModal = useCallback(async () => {
    if (!actionModal) return;
    const { kind, token, amount, reason } = actionModal;
    const trimmedAmount = String(amount || "").trim();
    const trimmedReason = String(reason || "").trim();

    if (!peerWallet || !myWallet) {
      notify("Select a contact before sending or requesting.", "warning");
      return;
    }
    if (!trimmedAmount) {
      notify("Enter an amount.", "warning");
      return;
    }

    const normalizedInput = trimmedAmount.replace(/,/g, ".");
    const validation = validateAmount(token, normalizedInput);
    if (!validation.ok) {
      notify(validation.reason || "Check the amount and token.", "error");
      return;
    }

    const numericAmount = Number(validation.value.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      notify("Amount must be greater than 0.", "error");
      return;
    }

    if (kind === "request" && trimmedReason.length > MAX_REASON_LEN) {
      notify("Reason cannot exceed 120 characters.", "error");
      return;
    }

    try {
      const memo = kind === "request" && trimmedReason ? trimmedReason : undefined;
      const args = { token, amount: validation.value, memo };
      const result = kind === "send"
        ? buildTransfer({ ...args, to: peerWallet })
        : kind === "request"
          ? buildRequest({ ...args, to: myWallet })
          : null;

      if (!result) {
        notify("Action not supported yet.", "error");
        return;
      }

      debugBlink('open', {
        kind,
        token,
        amount: result.amount,
        to: result.to,
        dialToUrl: result.dialToUrl,
      });

      if (kind === "send") {
        window.open(result.dialToUrl, "_blank", "noopener,noreferrer");
        notify("Opening your wallet…", "info");
        setActionModal(null);
        return;
      }

      const response = await sendPaymentRequest({
        token,
        amount: validation.value,
        actionUrl: result.actionUrl,
        solanaActionUrl: result.solanaActionUrl,
        dialToUrl: result.dialToUrl,
        blinkApiUrl: result.blinkApiUrl,
        note: trimmedReason || null,
      });

      if (!response?.ok) {
        notify(response?.reason || "Payment request failed.", "error");
        return;
      }

      notify("Payment request created.", "success");
      setActionModal(null);
    } catch (error) {
      debugBlink('error', { kind, token, amount: trimmedAmount, message: error?.message });
      const message = error?.message;
      if (message && message.toLowerCase().includes('not allowed')) {
        notify("This action link is not allowed.", "error");
      } else {
        notify(message || "Unable to open the payment link. Please try again.", "error");
      }
    }
  }, [actionModal, peerWallet, myWallet, debugBlink, sendPaymentRequest]);

  const closeAgreementModal = useCallback(() => setAgreementModalOpen(false), []);

  const submitAgreement = useCallback(async (values) => {
    const res = await sendAgreement(values);
    if (!res?.ok) {
      return { ok: false, reason: res?.reason || "Unable to create agreement." };
    }
    return { ok: true };
  }, [sendAgreement]);

  /* ---- envío (sin inserción aquí; la hace useMessaging) ---- */
  const onSendText = useCallback(
    async (plain) =>
      sendText(plain, {
        prefer: "auto",
        timeoutMs: MESSAGING.RTC_OPEN_TIMEOUT_MS || 1500,
      }),
    [sendText]
  );


  const hasContact = !!peerWallet;
  const canSend = !!(e2ee && e2ee.keyReady);
  const actionDisabled = !peerWallet || !myWallet;

  const dispatchActionEvent = useCallback((kind) => {
    if (!peerWallet || !myWallet) {
      if (!peerWallet) notify("Select a contact before sending or requesting.", "warning");
      else notify("Connect your wallet before using actions.", "warning");
      return;
    }
    window.dispatchEvent(new CustomEvent("chat:action:open", {
      detail: {
        kind,
        peerWallet,
        selfWallet: myWallet,
      },
    }));
  }, [peerWallet, myWallet]);

  return (
    <div className="chat-window">
      <div className="chat-window-inner">
        <ChatHeader
          selectedContact={selected}
          peerOnline={peerOnline}
          isTyping={isTypingRemote}
        />

        <div className="chat-window-body">
          <div className="chat-window-messages">
            <ChatMessages
              key={peerWallet || "none"}
              messages={messages}
              selectedContact={peerWallet}
              activePanel={activePanel}
              setActivePanel={setActivePanel}
            />
          </div>

          <div className="chat-composer-zone">
            <div className="chat-action-bar-shell" aria-hidden={!peerWallet}>
              <ActionBar
                disabled={actionDisabled}
                onSend={() => dispatchActionEvent("send")}
                onRequest={() => dispatchActionEvent("request")}
                onBuy={() => setBuyModalOpen(true)}
                onFund={() => setFundModalOpen(true)}
                onAgreement={() => dispatchActionEvent("agreement")}
              />
            </div>
            <WritingPanel
              key={peerWallet || "none"}
              onSendText={onSendText}
              onTyping={setTyping}
              hasContact={hasContact}
              activePeer={peerWallet}
              isContactConfirmed={true}
              canSend={canSend}
            />
          </div>
        </div>
      </div>

      {actionModal && (
        <div className="chat-action-modal-overlay" role="presentation">
          <div
            className="chat-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-action-title"
          >
            <header className="chat-action-header">
              <h2 id="chat-action-title">
                {actionModal.kind === "request" ? "Request payment" : "Send money"}
              </h2>
              <button
                type="button"
                className="chat-action-close"
                onClick={closeActionModal}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="chat-action-body">
              <p className="chat-action-description">
                {actionModal.kind === "request"
                  ? "Enter the amount and token. Your contact will open their wallet to review and pay."
                  : "Enter the amount and token. Your wallet will open to review and sign."}
              </p>

              {(peerLabel || selfLabel) && (
                <div className="chat-action-summary" aria-live="polite">
                  {actionModal.kind === "request" ? (
                    <>
                      <span>From: {selfLabel}</span>
                      <span>To: {peerLabel}</span>
                    </>
                  ) : (
                    <span>To: {peerLabel}</span>
                  )}
                </div>
              )}

              <label className="chat-action-field">
                <span>Amount</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={actionModal.amount}
                  onChange={(ev) => updateActionField("amount", ev.target.value)}
                  aria-describedby="chat-action-amount-help"
                />
                <small id="chat-action-amount-help" className="chat-action-help">
                  {actionModal.token === "SOL"
                    ? "Recommended minimum 0.001 SOL."
                    : "Up to 2 decimals."}
                </small>
              </label>

              <label className="chat-action-field">
                <span>Token</span>
                <select
                  value={actionModal.token}
                  onChange={(ev) => updateActionField("token", ev.target.value)}
                  aria-label="Token"
                >
                  {supportedTokens.map(({ code, symbol }) => (
                    <option key={code} value={code}>{symbol || code}</option>
                  ))}
                </select>
                <small className="chat-action-help">You can change the token later.</small>
              </label>

              {actionModal.kind === "request" && (
                <label className="chat-action-field">
                  <span>Reason (optional)</span>
                  <input
                    type="text"
                    maxLength={MAX_REASON_LEN}
                    placeholder="Reason (optional)"
                    value={actionModal.reason}
                    onChange={(ev) => updateActionField("reason", ev.target.value)}
                    aria-describedby="chat-action-reason-help"
                  />
                  <small id="chat-action-reason-help" className="chat-action-help">
                    Add a short note for your contact.
                  </small>
                </label>
              )}
            </div>

        <footer className="chat-action-footer">
          <button type="button" className="chat-action-secondary" onClick={closeActionModal}>
            Cancel
          </button>
          <button type="button" className="chat-action-primary" onClick={submitActionModal}>
            {actionModal.kind === "request" ? "Request" : "Pay"}
          </button>
        </footer>
          </div>
        </div>
      )}

      {agreementModalOpen && (
        <AgreementModal
          open={agreementModalOpen}
          onClose={closeAgreementModal}
          onSubmit={submitAgreement}
          tokens={supportedTokens}
          defaultToken={defaultToken}
          selfWallet={myWallet}
          peerWallet={peerWallet}
          selfLabel={selfLabel}
          peerLabel={peerLabel}
        />
      )}

      {buyModalOpen && (
        <BuyTokenModal
          open={buyModalOpen}
          onClose={() => setBuyModalOpen(false)}
        />
      )}

      {fundModalOpen && (
        <FundWalletModal
          open={fundModalOpen}
          onClose={() => setFundModalOpen(false)}
        />
      )}
    </div>
  );
}
