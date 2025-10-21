// src/features/messaging/ui/WritingPanel.jsx
// Compositor simplificado: sólo texto + envío rápido.

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Smile, X, Zap, Zap as ZapIcon } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import ENV from "@shared/config/env.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { notify } from "@shared/services/notificationService.js";
// Parser de comandos naturales simplificado
import { useBlinkDetection, BlinkList } from "./BlinkPreview.jsx";
import ActionBar from "./ActionBar.jsx";
import "./WritingPanel.css";

const TEXT_MAX_BYTES = Number(ENV?.MESSAGING?.TEXT_MAX_BYTES || 32 * 1024);

function utf8Length(str) {
  return new TextEncoder().encode(str).length;
}

const WritingPanel = React.memo(function WritingPanel({
  onSendText,
  onTyping, // opcional: (flag:boolean) => void
  hasContact,
  activePeer,
  isContactConfirmed = true,
  canSend = true,
  sendPaymentRequest, // función para enviar payment requests
  onOpenSendModal, // función para abrir modal de Send
  mode = "desktop",
  mobileActionBarProps = null,
}) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // const [commandPreview, setCommandPreview] = useState(null); // REMOVIDO - ahora usa placeholder dinámico
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const prevHeightRef = useRef(42);
  const emojiPickerRef = useRef(null);
  const emojiBtnRef = useRef(null);

  // Typing timers/refs
  const typingActiveRef = useRef(false);
  const typingIntervalRef = useRef(null);
  const lastTypingValueRef = useRef("");
  const gatedOnceRef = useRef(false);
  const { ensureReadyOnce, pubkey: myWallet } = useAuthManager();

  // Parser simplificado para comandos naturales

  // Detectar blinks en el mensaje
  const { detectedBlinks: currentBlinks, hasBlinks } = useBlinkDetection(message);

  const emitTyping = useCallback((flag) => {
    try { onTyping?.(flag); } catch {}
  }, [onTyping]);

  const stopTyping = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    if (!typingActiveRef.current) return;
    emitTyping(false);
    typingActiveRef.current = false;
    lastTypingValueRef.current = "";
  }, [emitTyping]);

  const startTyping = useCallback(() => {
    if (!typingActiveRef.current) {
      emitTyping(true);
      typingActiveRef.current = true;
    }
    if (!typingIntervalRef.current) {
      typingIntervalRef.current = setInterval(() => {
        if (typingActiveRef.current) emitTyping(true);
      }, 2000);
    }
  }, [emitTyping]);

  const updateTypingState = useCallback((rawValue) => {
    const hasText = rawValue.trim().length > 0;
    if (hasText) {
      const trimmed = rawValue.trim();
      lastTypingValueRef.current = trimmed;
      startTyping();
    } else {
      stopTyping();
    }
  }, [startTyping, stopTyping]);

  const resetInput = () => {
    setMessage("");
    updateTypingState("");
    if (inputRef.current) {
      inputRef.current.style.height = "";
      inputRef.current.classList.remove("scrolling");
      inputRef.current.focus();
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    // Validaciones básicas
    if (!hasContact) { notify("Select a contact before sending a message.", "error"); return; }
    if (!activePeer) { notify("No active peer selected.", "error"); return; }
    if (!isContactConfirmed) { notify("That contact is not confirmed yet. Accept/request before sending.", "warning"); return; }
    if (!canSend) { notify("Encryption key not ready.", "warning"); return; }
    if (utf8Length(trimmed) > TEXT_MAX_BYTES) {
      notify(`The message exceeds the maximum of ${TEXT_MAX_BYTES} bytes.`, "error");
      return;
    }

    try {
      setIsProcessingCommand(true);
      
      // ✅ DETECCIÓN DE COMANDO "enviar X sol"
      const sendCommand = trimmed.match(/\b(?:enviar|mandar|send(?:\s+(?:me|to))?)\s+(\d+(?:[.,]\d+)?)\s+sol\b/i);
      
      if (sendCommand) {
        const amount = sendCommand[1]?.replace(',', '.');
        console.log('🚀 Send command detected:', amount, 'SOL');
        
        // Abrir modal de Send con campos pre-rellenados
        if (onOpenSendModal) {
          // Activar animación de éxito
          setShowSuccessAnimation(true);
          
          // Abrir modal después de un pequeño delay para la animación
          setTimeout(() => {
            onOpenSendModal({
              kind: 'send',
              amount: amount,
              token: 'SOL'
            });
            resetInput();
            setShowSuccessAnimation(false);
          }, 800); // Duración de la animación
          return;
        } else {
          console.error('❌ onOpenSendModal function not provided');
        }
      }
      
      // Si no es un comando, enviar como mensaje normal
      const ready = await ensureReadyOnce();
      if (!ready) return;
      if (typeof onSendText !== "function") {
        notify("Messaging is not ready (missing onSendText).", "error");
        return;
      }
      const res = await onSendText(trimmed);
      if (!res?.ok) {
        notify(res?.reason ? `Send failed: ${res.reason}` : "Send failed", "error");
        return;
      }
      resetInput();
      
    } catch (error) {
      console.error("Error processing message:", error);
      notify(`Error: ${error.message}`, "error");
    } finally {
      setIsProcessingCommand(false);
    }
  }, [message, hasContact, activePeer, isContactConfirmed, canSend, myWallet, ensureReadyOnce, onSendText, onOpenSendModal]);

  // attachments removed in this MVP

  const adjustHeight = () => {
    if (!inputRef.current) return;
    const maxHeight = window.innerHeight * 0.4;
    inputRef.current.style.height = "auto";
    const newHeight = Math.min(inputRef.current.scrollHeight, maxHeight);
    inputRef.current.style.height = `${newHeight}px`;
    if (newHeight >= maxHeight) inputRef.current.classList.add("scrolling");
    else inputRef.current.classList.remove("scrolling");
    // spring animation when grows fast
    if (newHeight > prevHeightRef.current + 5 && wrapperRef.current) {
      wrapperRef.current.classList.remove("spring");
      // reflow
      void wrapperRef.current.offsetWidth;
      wrapperRef.current.classList.add("spring");
    }
    prevHeightRef.current = newHeight;
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setMessage(value);
    adjustHeight();
    updateTypingState(value);
    
    // Comando detection removido - ahora usa placeholder dinámico
  };

   // Placeholder dinámico
   const dynamicPlaceholder = useMemo(() => {
     if (!message.trim()) {
       return hasContact ? "Write a message..." : "Select a contact";
     }
     
     // Detectar si hay un blink en el mensaje
     const lowered = message.toLowerCase();
     const blinkDetected = lowered.includes('buy ') || 
                          lowered.includes('transfer ') ||
                          lowered.includes('swap ') ||
                          lowered.includes('enviar ') ||
                          lowered.includes('mandar ') ||
                          lowered.includes('send ');
     
     if (blinkDetected) {
       return "Enter para enviar blink";
     }
     
     // Si hay texto pero no es blink, mostrar placeholder vacío para que no interfiera
     return "";
   }, [message, hasContact]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // emoji picker
  const insertEmoji = (emoji) => {
    const cursorPos = inputRef.current?.selectionStart ?? message.length;
    const newText = message.slice(0, cursorPos) + emoji.native + message.slice(cursorPos);
    setMessage(newText);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.selectionEnd = cursorPos + emoji.native.length;
        inputRef.current.focus();
        adjustHeight();
      }
    });
    setShowEmojiPicker(false);
    updateTypingState(newText);
  };

  const handleFocus = async () => {
    if (!gatedOnceRef.current) {
      gatedOnceRef.current = true;
      try {
        await ensureReadyOnce();
      } catch {}
    }
    updateTypingState(message);
  };

  useEffect(() => () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    stopTyping();
  }, [stopTyping]);

  // close emoji on outside click or ESC
  useEffect(() => {
    if (!showEmojiPicker) return;
    const onDocClick = (e) => {
      const t = e.target;
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(t) &&
        (!emojiBtnRef.current || !emojiBtnRef.current.contains(t))
      ) {
        setShowEmojiPicker(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showEmojiPicker]);

  const isMobile = mode === "mobile";

  return (
    <div
      ref={wrapperRef}
      className={`writing-panel${isMobile ? " writing-panel--mobile" : ""}`}
      aria-live="polite"
    >
      {isMobile && mobileActionBarProps && (
        <div className="writing-panel-actions">
          <ActionBar mode="mobile" {...mobileActionBarProps} />
        </div>
      )}
      {/* Blink Previews */}
      {hasBlinks && (
        <div className="blink-previews-container">
          <BlinkList 
            urls={currentBlinks} 
            onExecute={(url) => {
              window.open(url, '_blank', 'noopener,noreferrer');
              notify('Abriendo blink...', 'info');
            }}
          />
        </div>
      )}
      
      <div className="input-row">
         <div className={`input-wrapper ${message.trim() ? "has-text" : ""}`}>
          {/* Input con texto dinámico que incluye la sugerencia */}
          <div className="dynamic-text-container">
            <span className="user-text">
              {message}
            </span>
            {message.trim() && dynamicPlaceholder.includes("Enter para enviar blink") && (
              <span className="blink-suggestion-inline" 
                    style={{ marginLeft: `${message.length * 0.6}em` }}>
                <ZapIcon size={16} strokeWidth={2} className={`blink-icon ${showSuccessAnimation ? 'success-fill' : ''}`} />
                {dynamicPlaceholder}
              </span>
            )}
          </div>
          
          <textarea
            ref={inputRef}
            className="chat-input input-base input-lg"
            placeholder={!message.trim() ? dynamicPlaceholder : ""}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={stopTyping}
            rows={1}
            disabled={!hasContact}
          />

          <div className="left-icons-container">
            <button
              type="button"
              className="emoji-icon"
              ref={emojiBtnRef}
              onClick={() => setShowEmojiPicker((v) => !v)}
              title="Emoji"
              aria-label="Insert emoji"
            >
              <Smile size={20} />
            </button>
          </div>

          {message.trim() && (
            <button
              type="button"
              className="clear-icon"
              onClick={resetInput}
              aria-label="Clear message"
              title="Clear"
            >
              <X size={16} />
            </button>
          )}

          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="emoji-picker-wrapper">
              <Picker data={data} onEmojiSelect={insertEmoji} theme="auto" />
            </div>
          )}
        </div>

          <button
            type="button"
            className="send-button"
            onClick={handleSend}
            disabled={!message.trim() || !canSend || isProcessingCommand}
            aria-label="Send message"
            title="Send"
          >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

export default WritingPanel;
