// src/features/messaging/ui/WritingPanel.jsx
// Compositor simplificado: sólo texto + envío rápido.

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Send, Smile, X } from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import ENV from "@shared/config/env.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { notify } from "@shared/services/notificationService.js";
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
}) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const prevHeightRef = useRef(42);
  const emojiPickerRef = useRef(null);
  const emojiBtnRef = useRef(null);

  // Typing timers/refs
  const typingDebounceRef = useRef(null);
  const typingInactivityRef = useRef(null);
  const typingStateRef = useRef({ active: false, lastSentTrueAt: 0 });
  const gatedOnceRef = useRef(false);
  const { ensureReady } = useAuthManager();

  const resetInput = () => {
    setMessage("");
    if (inputRef.current) {
      inputRef.current.style.height = "";
      inputRef.current.classList.remove("scrolling");
      inputRef.current.focus();
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    if (!hasContact) { notify("Select a contact before sending a message.", "error"); return; }
    if (!activePeer) { notify("No active peer selected.", "error"); return; }
    if (!isContactConfirmed) { notify("That contact is not confirmed yet. Accept/request before sending.", "warning"); return; }
    if (!canSend) { notify("Encryption key not ready.", "warning"); return; }
    if (utf8Length(trimmed) > TEXT_MAX_BYTES) {
      notify(`The message exceeds the maximum of ${TEXT_MAX_BYTES} bytes.`, "error");
      return;
    }

    try {
      const ready = await ensureReady();
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
      console.error("Error sending message:", error);
      notify("Error sending the message. Check your connection.", "error");
    }
  }, [message, hasContact, activePeer, isContactConfirmed, canSend, ensureReady, onSendText]);

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
    setMessage(event.target.value);
    adjustHeight();
    // typing notify
    const text = event.target.value;
    if (text.trim().length > 0) notifyTypingInput();
    else stopTypingImmediate();
  };

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
    if (newText.trim().length > 0) notifyTypingInput();
    else stopTypingImmediate();
  };

  // typing helpers
  const sendTypingTrue = () => { try { onTyping?.(true); } catch {} };
  const sendTypingFalse = () => { try { onTyping?.(false); } catch {} };
  const scheduleAutoOff = () => {
    if (typingInactivityRef.current) clearTimeout(typingInactivityRef.current);
    typingInactivityRef.current = setTimeout(() => {
      if (typingStateRef.current.active) {
        sendTypingFalse();
        typingStateRef.current.active = false;
      }
    }, 2000);
  };
  const notifyTypingInput = () => {
    const now = Date.now();
    const st = typingStateRef.current;
    if (!st.active) {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        sendTypingTrue();
        st.active = true;
        st.lastSentTrueAt = Date.now();
      }, 700);
    } else if (now - st.lastSentTrueAt >= 2000) {
      sendTypingTrue();
      st.lastSentTrueAt = now;
    }
    scheduleAutoOff();
  };
  const stopTypingImmediate = () => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (typingInactivityRef.current) clearTimeout(typingInactivityRef.current);
    if (typingStateRef.current.active) {
      sendTypingFalse();
      typingStateRef.current.active = false;
    }
  };

  const handleFocus = async () => {
    if (!gatedOnceRef.current) {
      gatedOnceRef.current = true;
      try {
        await ensureReady();
      } catch {}
    }
    if (message.trim().length > 0) notifyTypingInput();
  };

  useEffect(() => () => {
    // cleanup timers
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (typingInactivityRef.current) clearTimeout(typingInactivityRef.current);
  }, []);

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

  return (
    <div ref={wrapperRef} className="writing-panel" aria-live="polite">
      <div className={`input-wrapper ${message.trim() ? "has-text" : ""}`}>
        <textarea
          ref={inputRef}
          className="chat-input input-base input-lg"
          placeholder={hasContact ? "Write a message..." : "Select a contact"}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={stopTypingImmediate}
          rows={1}
          // Permitir escribir si hay contacto, aunque la clave E2EE no esté lista
          disabled={!hasContact}
        />

        {/* Iconos a la izquierda */}
        <div className="left-icons-container">
          <button
            type="button"
            className="emoji-icon"
            ref={emojiBtnRef}
            onClick={() => setShowEmojiPicker((v) => !v)}
            title="Emoji"
            aria-label="Insert emoji"
          >
            <Smile size={18} />
          </button>
        </div>

        {/* Clear */}
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

      {/* Enviar */}
      <button
        type="button"
        className="send-button"
        onClick={handleSend}
        disabled={!message.trim() || !canSend}
        aria-label="Send message"
        title="Send"
      >
        <Send size={18} />
      </button>
    </div>
  );
});

export default WritingPanel;
