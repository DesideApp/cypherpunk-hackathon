import React, { useState } from 'react';
import { X } from 'lucide-react';
import { UiSearchInput } from '@shared/ui';
import './SettingsPanel.css';

export default function SettingsPanel({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        {/* Search Test */}
        <div className="settings-search-test">
          <UiSearchInput
            placeholder="Search settings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Content */}
        <div className="settings-content">
          <div className="settings-section">
            <h3 className="settings-section-title">General</h3>
            <p className="settings-placeholder">Settings panel placeholder</p>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Notifications</h3>
            <p className="settings-placeholder">Coming soon...</p>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Privacy</h3>
            <p className="settings-placeholder">Coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

