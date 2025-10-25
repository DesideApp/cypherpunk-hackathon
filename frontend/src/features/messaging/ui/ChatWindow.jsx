// src/features/messaging/ui/ChatWindow.jsx
import React, { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import ChatHeader from "./ChatHeader";
import WritingPanel from "./WritingPanel";
import ChatMessages from "./ChatMessages";
import ActionBar from "./ActionBar.jsx";

import useMessaging from "@features/messaging/hooks/useMessaging";
import { ENV, MESSAGING, MOCKS, FEATURES } from "@shared/config/env.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { useRtcDialer } from "@features/messaging/hooks/useRtcDialer.js";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useRpc } from "@wallet-adapter/core/contexts/RpcProvider";
import { subscribe, getState, convId as canonicalConvId } from "@features/messaging/store/messagesStore.js";
import { buildTransfer, buildRequest } from "@features/messaging/actions/blinkUrlBuilder.js";
import {
  listSupportedTokens,
  validateAmount,
} from "@shared/tokens/tokens.js";
import { notify } from "@shared/services/notificationService.js";
import { createDebugLogger } from "@shared/utils/debug.js";
import { assertAllowed } from "@features/messaging/config/blinkSecurity.js";
import { executeBlink } from "@features/messaging/services/blinkExecutionService.js";
import { useLayout } from "@features/layout/contexts/LayoutContext";
import "./ChatWindow.css";
import AgreementModal from "./modals/AgreementModal.jsx";
import BuyTokenModal from "./modals/BuyTokenModal.jsx";
import FundWalletModal from "./modals/FundWalletModal.jsx";
import SendModal from "./modals/SendModal.jsx";
import RequestModal from "./modals/RequestModal.jsx";
import { toUiMessage } from "@features/messaging/utils/toUiMessage.js";
import useUserProfile from "@shared/hooks/useUserProfile.js";

/* -------------------- helpers -------------------- */
function normalizeSelected(sel) {
  if (!sel) return { pubkey: null, nickname: null, avatar: null };
  if (typeof sel === "string") return { pubkey: sel, nickname: null, avatar: null };
  const key = sel.pubkey || sel.wallet || sel.id || null;
  return { pubkey: key, nickname: sel.nickname || sel.name || null, avatar: sel.avatar || null };
}

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

const MAX_REASON_LEN = 120;

/* ===================== Componente ===================== */

export default function ChatWindow({ selectedContact, activePanel, setActivePanel, allowMobileMenu = true }) {
  const { pubkey: myWallet } = useAuthManager();
  const { closeRtc } = useRtcDialer();
  const walletCtx = useWallet();
  const { connection } = useRpc();
  const adapter = walletCtx?.adapter || null;
  const { isMobile, setLeftbarExpanded } = useLayout();
  const isMobileLayout = isMobile;

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

  const inlinePaymentsEnabled = FEATURES.PAYMENT_INLINE_EXEC;
  const inlineSendCapable = useMemo(
    () => inlinePaymentsEnabled && adapter && connection && walletAddress,
    [inlinePaymentsEnabled, adapter, connection, walletAddress]
  );

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
    sendBlinkAction,
    sendAgreement,
    shareAgreementUpdate,
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

  const handleAgreementUpdateEvent = useCallback((event) => {
    const detail = event?.detail || {};
    if (!detail?.agreement || !detail?.receipt) return;
    if (detail.convId && convId && detail.convId !== convId) return;

    shareAgreementUpdate({
      agreement: detail.agreement,
      receipt: detail.receipt,
      clientId: detail.clientId || null,
      messageId: detail.messageId || null,
    });
  }, [shareAgreementUpdate, convId]);

  useEffect(() => {
    window.addEventListener('chat:agreement:update', handleAgreementUpdateEvent);
    return () => window.removeEventListener('chat:agreement:update', handleAgreementUpdateEvent);
  }, [handleAgreementUpdateEvent]);

  // Mapear a shape UI
  const messages = useMemo(
    () => (Array.isArray(rawMessages) ? rawMessages.map((m) => toUiMessage(m, myWallet, convId)).filter(Boolean) : []),
    [rawMessages, myWallet, convId]
  );

  const executeInlineTransfer = useCallback(
    async (blink) => {
      if (!adapter || !connection || !walletAddress) {
        console.warn("[blink] inline send fallback: missing adapter/connection", {
          hasAdapter: !!adapter,
          hasConnection: !!connection,
          walletAddress,
        });
        notify("Connect your wallet before sending.", "warning");
        return null;
      }

      try {
        assertAllowed(blink.actionUrl, { feature: "payment-send" });
      } catch (error) {
        const message = error?.message || "Payment link not allowed.";
        notify(message, message.includes("not allowed") ? "error" : "warning");
        return null;
      }

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
        const payload = await executeBlink(blink.actionUrl, walletAddress, { signal: controller?.signal });
        const signatures = [];
        if (payload?.type === "transaction" && typeof payload.transaction === "string") {
          signatures.push(await executeTransaction(payload.transaction));
        } else if (payload?.type === "transactions" && Array.isArray(payload.transactions)) {
          for (const serialized of payload.transactions) {
            if (typeof serialized !== "string") continue;
            signatures.push(await executeTransaction(serialized));
          }
        } else {
          throw new Error("Unexpected response from payment action.");
        }

        const primarySig = signatures[signatures.length - 1] || signatures[0] || null;
        return primarySig || null;
      } catch (error) {
        if (error?.name === "AbortError") {
          notify("Payment request timed out. Opening Dialect…", "warning");
          if (blink?.dialToUrl) {
            window.open(blink.dialToUrl, "_blank", "noopener,noreferrer");
          }
          console.warn("[blink] inline send aborted; falling back to Dialect", {
            actionUrl: blink?.actionUrl,
            reason: "abort",
          });
          return null;
        }
        if (isUserCancelled(error)) {
          notify("Signature cancelled in wallet.", "warning");
          console.info("[blink] inline send cancelled in wallet", {
            actionUrl: blink?.actionUrl,
          });
          return null;
        }
        notify(error?.message || "Couldn't complete payment. Opening Dialect…", "warning");
        if (blink?.dialToUrl) {
          window.open(blink.dialToUrl, "_blank", "noopener,noreferrer");
        }
        console.warn("[blink] inline send failed; falling back to Dialect", {
          actionUrl: blink?.actionUrl,
          message: error?.message,
          code: error?.code,
        });
        return null;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
    [adapter, connection, walletAddress]
  );

  const debugBlink = useMemo(
    () => createDebugLogger("blink", { envKey: "VITE_DEBUG_BLINK_LOGS" }),
    []
  );

  const supportedTokens = useMemo(() => listSupportedTokens(), []);
  const defaultToken = supportedTokens[0]?.code || "USDC";

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buyPreset, setBuyPreset] = useState(null);
  const [fundModalOpen, setFundModalOpen] = useState(false);

  const peerLabel = useMemo(() => {
    const pk = selected?.pubkey;
    if (!pk) return "";
    if (selected?.nickname) return selected.nickname;
    return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
  }, [selected]);

  // Perfil para hero de primera conversación
  const { profile: heroProfile } = useUserProfile(peerWallet, { ensure: !!peerWallet });
  const [hasDraft, setHasDraft] = useState(false);
  const onTypingLocal = useCallback((flag) => {
    try { setTyping(!!flag); } catch {}
    setHasDraft(!!flag);
  }, [setTyping]);

  const trunc = useCallback((s) => {
    if (!s) return "";
    const str = String(s);
    if (str.length <= 10) return str;
    return `${str.slice(0,4)}...${str.slice(-4)}`;
  }, []);

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
  const viewportRef = useRef(null);

  useEffect(() => {
    const previousPeer = prevPeerRef.current;
    prevPeerRef.current = peerWallet;

    return () => {
      if (previousPeer) {
        try { closeRtc?.(previousPeer); } catch {}
      }
    };
  }, [peerWallet, closeRtc]);

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

      if (kind === 'send') {
        setSendModalOpen(true);
        return;
      }

      if (kind === 'request') {
        setRequestModalOpen(true);
        return;
      }
    };

    window.addEventListener("chat:action:open", handler);
    return () => window.removeEventListener("chat:action:open", handler);
  }, [peerWallet, myWallet]);

  const closeAgreementModal = useCallback(() => setAgreementModalOpen(false), []);

  const handleAgreementSubmit = useCallback(async ({ title, body, amount, token, payer, payee, deadline }) => {
    const MAX_BODY_LEN = 500;
    const MAX_TITLE_LEN = 120;

    const trimmedTitle = String(title || "").trim();
    if (!trimmedTitle) {
      notify("Title is required.", "error");
      throw new Error("No title");
    }
    if (trimmedTitle.length > MAX_TITLE_LEN) {
      notify(`Title cannot exceed ${MAX_TITLE_LEN} characters.`, "error");
      throw new Error("Title too long");
    }

    const trimmedBody = String(body || "").trim() || null;
    if (trimmedBody && trimmedBody.length > MAX_BODY_LEN) {
      notify(`Description cannot exceed ${MAX_BODY_LEN} characters.`, "error");
      throw new Error("Body too long");
    }

    let normalizedAmount = null;
    let normalizedToken = null;

    if (amount) {
      const trimmedAmount = String(amount).trim();
      const upperToken = String(token || "").toUpperCase();
      
      const validation = validateAmount(upperToken, trimmedAmount);
      if (!validation.ok) {
        notify(validation.reason || "Check the amount and token.", "error");
        throw new Error(validation.reason);
      }

      const numericAmount = Number(validation.value);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        notify("Amount must be greater than 0.", "error");
        throw new Error("Invalid amount");
      }

      normalizedAmount = validation.value;
      normalizedToken = upperToken;
    }

    let isoDeadline = null;
    if (deadline) {
      const d = new Date(deadline);
      if (Number.isNaN(d.getTime())) {
        notify("Invalid deadline.", "error");
        throw new Error("Invalid deadline");
      }
      if (d.getTime() <= Date.now()) {
        notify("Deadline must be in the future.", "error");
        throw new Error("Deadline in past");
      }
      isoDeadline = d.toISOString();
    }

    const res = await sendAgreement({
      title: trimmedTitle,
      body: trimmedBody,
      amount: normalizedAmount,
      token: normalizedToken,
      payer,
      payee,
      deadline: isoDeadline,
    });

    if (!res?.ok) {
      notify(res?.reason || "Unable to create agreement.", "error");
      throw new Error(res?.reason || "Failed");
    }

    notify("Agreement created.", "success");
  }, [sendAgreement]);

  const handleSendSubmit = useCallback(async ({ amount, token }) => {
    const trimmedAmount = String(amount || "").trim();
    if (!peerWallet || !myWallet) {
      notify("Select a contact before sending.", "warning");
      throw new Error("No contact");
    }
    if (!trimmedAmount) {
      notify("Enter an amount.", "warning");
      throw new Error("No amount");
    }

    const normalizedInput = trimmedAmount.replace(/,/g, ".");
    const validation = validateAmount(token, normalizedInput);
    if (!validation.ok) {
      notify(validation.reason || "Check the amount and token.", "error");
      throw new Error(validation.reason);
    }

    const numericAmount = Number(validation.value.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      notify("Amount must be greater than 0.", "error");
      throw new Error("Invalid amount");
    }

    const result = buildTransfer({ token, amount: validation.value, to: peerWallet });
    if (!result) {
      notify("Send action not available.", "error");
      throw new Error("Build failed");
    }

    debugBlink('open', {
      kind: 'send',
      token,
      amount: result.amount,
      to: result.to,
      dialToUrl: result.dialToUrl,
      inlineCapable: inlineSendCapable,
    });

    if (!inlineSendCapable) {
      console.info("[blink] inline send fallback: capability disabled", {
        inlinePaymentsEnabled,
        hasAdapter: !!adapter,
        hasConnection: !!connection,
        walletAddress,
      });
      if (result?.dialToUrl) {
        window.open(result.dialToUrl, "_blank", "noopener,noreferrer");
        notify("Opening your wallet…", "info");
      } else {
        notify("Payment link not available.", "warning");
      }
      return;
    }

    const signature = await executeInlineTransfer(result);
    if (signature) {
      notify("Payment sent.", "success");
      try {
        await sendBlinkAction({
          kind: "transfer",
          token: result.token,
          amount: result.amount,
          amountInSol: result.token === "SOL" ? result.amount : null,
          actionUrl: result.actionUrl,
          solanaActionUrl: result.solanaActionUrl,
          dialToUrl: result.dialToUrl,
          blinkApiUrl: result.blinkApiUrl,
          txSig: signature,
          source: "inline-send",
        });
      } catch (shareError) {
        debugBlink('share-error', {
          context: 'inline-send',
          error: shareError?.message || 'unknown',
        });
        console.warn("[blink] inline send share error", {
          message: shareError?.message,
        });
      }
    }
  }, [peerWallet, myWallet, debugBlink, inlineSendCapable, executeInlineTransfer, sendBlinkAction, inlinePaymentsEnabled, adapter, connection, walletAddress]);

  const handleRequestSubmit = useCallback(async ({ amount, token, reason }) => {
    const trimmedAmount = String(amount || "").trim();
    const trimmedReason = String(reason || "").trim();

    if (!peerWallet || !myWallet) {
      notify("Select a contact before requesting.", "warning");
      throw new Error("No contact");
    }
    if (!trimmedAmount) {
      notify("Enter an amount.", "warning");
      throw new Error("No amount");
    }

    const normalizedInput = trimmedAmount.replace(/,/g, ".");
    const validation = validateAmount(token, normalizedInput);
    if (!validation.ok) {
      notify(validation.reason || "Check the amount and token.", "error");
      throw new Error(validation.reason);
    }

    const numericAmount = Number(validation.value.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      notify("Amount must be greater than 0.", "error");
      throw new Error("Invalid amount");
    }

    if (trimmedReason.length > MAX_REASON_LEN) {
      notify("Reason cannot exceed 120 characters.", "error");
      throw new Error("Reason too long");
    }

    const result = buildRequest({ token, amount: validation.value, to: myWallet, memo: trimmedReason || undefined });
    if (!result) {
      notify("Request action not available.", "error");
      throw new Error("Build failed");
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
      throw new Error(response?.reason || "Failed");
    }

    notify("Payment request created.", "success");
  }, [peerWallet, myWallet, sendPaymentRequest]);

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

  const openContactsPanel = useCallback(() => {
    if (typeof setActivePanel === "function") {
      setActivePanel("left");
    }
  }, [setActivePanel]);

  const openLeftbarDrawer = useCallback(() => {
    setLeftbarExpanded((prev) => !prev);
  }, [setLeftbarExpanded]);

  // Función para abrir modal de Send desde comandos naturales
  const openSendModal = useCallback((params) => {
    if (!peerWallet || !myWallet) {
      if (!peerWallet) notify("Select a contact before sending.", "warning");
      else notify("Connect your wallet before using actions.", "warning");
      return;
    }
    
    console.log('🚀 Opening Send modal with params:', params);
    
    window.dispatchEvent(new CustomEvent("chat:action:open", {
      detail: {
        kind: 'send',
        amount: params.amount,
        token: params.token,
        peerWallet,
        selfWallet: myWallet,
      },
    }));
  }, [peerWallet, myWallet]);

  const handleBlinkShared = useCallback((payload) => {
    if (!payload) return;
    sendBlinkAction({
      kind: payload.kind || 'buy',
      token: payload.token || null,
      amountInSol: payload.amountInSol ?? payload.amount ?? null,
      expectedOut: payload.expectedOut ?? null,
      actionUrl: payload.actionUrl || null,
      solanaActionUrl: payload.solanaActionUrl || null,
      dialToUrl: payload.dialToUrl || null,
      blinkApiUrl: payload.blinkApiUrl || null,
      txSig: payload.txSig || null,
      source: payload.source || 'local',
      meta: payload.meta || null,
    });
  }, [sendBlinkAction]);

  const triggerMockBlink = useCallback((overrides = {}) => {
    if (!peerWallet || !myWallet) {
      notify("Select a contact before sending a mock blink.", "warning");
      return;
    }
    const defaults = {
      kind: "buy",
      token: "BONK",
      amountInSol: 0.1,
      expectedOut: null,
      actionUrl: null,
      solanaActionUrl: null,
      dialToUrl: "https://jupiter.dial.to/swap/SOL-BONK",
      blinkApiUrl: null,
      txSig: "MOCK_SIG",
      source: "mock",
      meta: null,
    };
    const payload = { ...defaults, ...overrides };
    sendBlinkAction(payload);
    notify("Mock blink message sent.", "info");
  }, [peerWallet, myWallet, sendBlinkAction]);

  useEffect(() => {
    if (!MOCKS.BLINK_BUY) return undefined;
    if (typeof window === "undefined") return undefined;

    const ns = window.__DESIDE_DEBUG || (window.__DESIDE_DEBUG = {});
    ns.sendMockBlinkBuy = triggerMockBlink;

    return () => {
      if (window.__DESIDE_DEBUG) {
        delete window.__DESIDE_DEBUG.sendMockBlinkBuy;
      }
    };
  }, [triggerMockBlink]);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail || {};
      const { token, amount, multiplier, peerWallet: targetPeer, shareOnComplete } = detail;
      if (!token || amount === undefined || amount === null) return;
      if (targetPeer && peerWallet && targetPeer !== peerWallet) return;
      const numeric = Number(amount);
      const formatted = Number.isFinite(numeric)
        ? Number(numeric.toFixed(6)).toString().replace(/\.?0+$/, "")
        : String(amount);
      setBuyPreset({
        token,
        amount: formatted,
        multiplier: multiplier || 1,
        share: shareOnComplete !== false,
      });
      setBuyModalOpen(true);
    };
    window.addEventListener("chat:blink:buy", handler);
    return () => window.removeEventListener("chat:blink:buy", handler);
  }, [peerWallet]);

  useEffect(() => {
    if (!isMobileLayout) return undefined;
    if (typeof window === "undefined") return undefined;

    const container = viewportRef.current;
    if (!container) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousTouchAction = body.style.touchAction || "";
    const previousOverscroll = body.style.overscrollBehaviorY || "";
    const previousHtmlHeight = html.style.height;
    const previousBodyHeight = body.style.height;

    const applyViewportMetrics = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      container.style.setProperty("--chat-viewport-height", `${height}px`);
      container.style.setProperty("--chat-viewport-offset-top", `${offsetTop}px`);
    };

    applyViewportMetrics();

    const visualViewport = window.visualViewport;
    const handleViewportChange = () => applyViewportMetrics();

    if (visualViewport) {
      visualViewport.addEventListener("resize", handleViewportChange);
      visualViewport.addEventListener("scroll", handleViewportChange);
    } else {
      window.addEventListener("resize", handleViewportChange);
    }

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";
    body.style.touchAction = "manipulation";
    body.style.overscrollBehaviorY = "contain";

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener("resize", handleViewportChange);
        visualViewport.removeEventListener("scroll", handleViewportChange);
      } else {
        window.removeEventListener("resize", handleViewportChange);
      }

      container.style.removeProperty("--chat-viewport-height");
      container.style.removeProperty("--chat-viewport-offset-top");

      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.height = previousHtmlHeight;
      body.style.height = previousBodyHeight;
      body.style.touchAction = previousTouchAction;
      body.style.overscrollBehaviorY = previousOverscroll;
    };
  }, [isMobileLayout]);

  const heroActive = !!peerWallet && messages.length === 0 && !hasDraft;

  return (
    <div
      ref={viewportRef}
      className={`chat-window ${isMobileLayout ? "chat-window--mobile" : ""}`}
    >
      <div className="chat-window-inner">
        {!heroActive && (
          <ChatHeader
            selectedContact={selected}
            peerOnline={peerOnline}
            isTyping={isTypingRemote}
            messages={messages}
            onSearchSelect={(msg) => {
              // TODO: scroll al mensaje seleccionado
              console.log("Selected message:", msg);
            }}
            isCompactLayout={isMobileLayout}
            onOpenContacts={isMobileLayout ? openContactsPanel : undefined}
            onOpenLeftbar={isMobileLayout && allowMobileMenu ? openLeftbarDrawer : undefined}
          />
        )}

        <div className="chat-window-body">
          <div className="chat-window-messages">
            {/* Hero de primera conversación */}
            {peerWallet && messages.length === 0 && (
              <div className="first-conv-hero" role="region" aria-label="First conversation">
                <div className="first-conv-hero__avatar">
                  {heroProfile?.avatar ? (
                    <img src={heroProfile.avatar} alt="" />
                  ) : (
                    <span>{(heroProfile?.nickname || peerLabel || "?").slice(0,1)}</span>
                  )}
                </div>
                <h3 className="first-conv-hero__name">{heroProfile?.nickname || peerLabel}</h3>
                <p className="first-conv-hero__hint">
                  Messaging wallet‑to‑wallet off chain. Encrypted on your device. Only you and {heroProfile?.nickname || peerLabel} ({trunc(peerWallet)}) can read this chat.
                </p>
                <div className="first-conv-hero__today">Today</div>
              </div>
            )}

            <ChatMessages
              key={peerWallet || "none"}
              messages={messages}
              selectedContact={peerWallet}
              activePanel={activePanel}
              setActivePanel={setActivePanel}
            />
          </div>

          <div className="chat-composer-zone">
            {!isMobileLayout && (
              <div className="chat-action-bar-shell" aria-hidden={!peerWallet}>
                <ActionBar
                  disabled={actionDisabled}
                  onSend={() => dispatchActionEvent("send")}
                  onRequest={() => dispatchActionEvent("request")}
                  onBuy={() => {
                    setBuyPreset({ share: true });
                    setBuyModalOpen(true);
                  }}
                  onBuyMock={MOCKS.BLINK_BUY ? () => triggerMockBlink() : undefined}
                  onFund={() => setFundModalOpen(true)}
                  onAgreement={() => dispatchActionEvent("agreement")}
                  mode="desktop"
                />
              </div>
            )}
            <WritingPanel
              key={peerWallet || "none"}
              onSendText={onSendText}
              onTyping={onTypingLocal}
              hasContact={hasContact}
              activePeer={peerWallet}
              isContactConfirmed={true}
              canSend={canSend}
              sendPaymentRequest={sendPaymentRequest}
              onOpenSendModal={openSendModal}
              mode={isMobileLayout ? "mobile" : "desktop"}
              mobileActionBarProps={
                isMobileLayout
                  ? {
                      disabled: actionDisabled,
                      onSend: () => dispatchActionEvent("send"),
                      onRequest: () => dispatchActionEvent("request"),
                      onBuy: () => {
                        setBuyPreset({ share: true });
                        setBuyModalOpen(true);
                      },
                      onBuyMock: MOCKS.BLINK_BUY ? () => triggerMockBlink() : undefined,
                      onFund: () => setFundModalOpen(true),
                      onAgreement: () => dispatchActionEvent("agreement"),
                    }
                  : null
              }
            />
          </div>
        </div>
      </div>

      <SendModal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        onSubmit={handleSendSubmit}
        peerLabel={peerLabel}
        peerPubkey={selected?.pubkey}
        selfLabel={selfLabel}
        defaultToken={defaultToken}
      />

      <RequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onSubmit={handleRequestSubmit}
        peerLabel={peerLabel}
        selfLabel={selfLabel}
        peerPubkey={selected?.pubkey}
        peerNickname={selected?.nickname}
        defaultToken={defaultToken}
      />

      {agreementModalOpen && (
        <AgreementModal
          open={agreementModalOpen}
          onClose={closeAgreementModal}
          onSubmit={handleAgreementSubmit}
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
          presetToken={buyPreset?.token || null}
          presetAmount={buyPreset?.amount || null}
          shareOnComplete={buyPreset?.share !== false}
          onClose={() => {
            setBuyModalOpen(false);
            setBuyPreset(null);
          }}
          onBlinkShared={handleBlinkShared}
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
