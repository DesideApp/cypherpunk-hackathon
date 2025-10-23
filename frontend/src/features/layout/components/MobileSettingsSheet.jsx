import React from "react";
import ThemeToggle from "@features/layout/components/ThemeToggle.jsx";
import "./MobileSettingsSheet.css";

export default function MobileSettingsSheet({ open = false, onClose = () => {} }) {
  if (!open) return null;

  return (
    <div className="mobile-settings-overlay" onClick={onClose} role="presentation">
      <div
        className="mobile-settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mobile-settings-sheet__header">
          <h2>Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </header>
        <div className="mobile-settings-sheet__content">
          <div className="mobile-settings-option">
            <span className="mobile-settings-option__label">Theme</span>
            <ThemeToggle variant="switch" />
          </div>
        </div>
      </div>
    </div>
  );
}
