// src/features/messaging/ui/EmptyWelcome.jsx
import React from 'react';
import './EmptyWelcome.css';

export default function EmptyWelcome({ onOpenContacts }) {
  return (
    <div className="empty-welcome" role="region" aria-label="Welcome">
      <div className="empty-welcome__card">
        <div className="empty-welcome__brand">Deside App</div>
        <h2 className="empty-welcome__title">Welcome to Deside App</h2>
        <p className="empty-welcome__blurb">
          Wallet‑first actions and private messaging. Send, request, or buy without leaving the thread.
        </p>

        <ul className="empty-welcome__features">
          <li>Wallet‑to‑wallet, off chain</li>
          <li>Encrypted on your device</li>
          <li>Non‑custodial</li>
        </ul>

        <div className="empty-welcome__cta">
          <button className="ew-btn" onClick={onOpenContacts}>Add contact</button>
        </div>

        <div className="empty-welcome__disclaimer">
          <strong>Beta disclaimer.</strong> Use with care and at your own risk. Deside does not custody funds or private keys. Transactions are prepared by third‑party providers and signed locally by you. This is not financial advice.
        </div>
      </div>
    </div>
  );
}

