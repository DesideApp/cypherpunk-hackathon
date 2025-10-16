// src/features/messaging/ui/ContactList.jsx
import React, { useState, memo, useMemo, useCallback } from "react";
import { FaSearch } from "react-icons/fa";
import "./ContactList.css";

const formatPubkey = (wallet) => {
  if (!wallet) return "";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

const ContactList = ({
  confirmedContacts = [],
  previews = [],
  onContactSelected,
  selectedWallet = null,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Construir listado unificado (contactos confirmados + previews locales)
  const contactsMap = useMemo(() => {
    const map = {};
    for (const c of confirmedContacts) {
      if (!c?.wallet) continue;
      map[c.wallet] = { ...c, isContact: true };
    }
    for (const p of previews) {
      const key = p?.chatId;
      if (!key || map[key]) continue;
      map[key] = {
        wallet: key,
        nickname: null,
        lastMessageText: p.lastMessageText,
        lastMessageTimestamp: p.lastMessageTimestamp,
        isContact: false,
      };
    }
    return map;
  }, [confirmedContacts, previews]);

  const allContacts = useMemo(() => Object.values(contactsMap), [contactsMap]);

  const filteredContacts = useMemo(() => {
    const term = (searchTerm || "").toLowerCase().trim();
    if (!term) return allContacts;
    return allContacts.filter((c) =>
      (c.nickname && c.nickname.toLowerCase().includes(term)) ||
      (c.wallet && c.wallet.toLowerCase().includes(term)) ||
      (c.lastMessageText && c.lastMessageText.toLowerCase().includes(term))
    );
  }, [allContacts, searchTerm]);

  const selectContact = useCallback((wallet) => {
    if (!wallet) return;
    // ❌ No gateamos aquí: abrir la conversación debe funcionar aun sin auth.
    onContactSelected?.(wallet);
  }, [onContactSelected]);

  return (
    <div className="contact-list-container">
      <div className="search-bar">
        <FaSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search contacts"
        />
      </div>

      {filteredContacts.length > 0 ? (
        <ul className="contact-list" role="listbox" aria-label="Contacts">
          {filteredContacts.map((c) => (
            <li
              key={c.wallet}
              className={`contact-item ${selectedWallet === c.wallet ? "active" : ""}`}
              onClick={() => selectContact(c.wallet)}
              role="option"
              aria-selected={selectedWallet === c.wallet}
              title={c.nickname || c.wallet}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectContact(c.wallet);
                }
              }}
            >
              {c.avatar && (
                <img
                  src={c.avatar}
                  alt=""
                  className="contact-avatar"
                  aria-hidden="true"
                />
              )}

              <span className="contact-name">
                {c.isContact ? (c.nickname || formatPubkey(c.wallet))
                             : `Desconocido (${formatPubkey(c.wallet)})`}
              </span>

              {c.lastMessageText && (
                <span className="contact-preview text-gray-500 text-xs block truncate">
                  {c.lastMessageText}
                </span>
              )}

              {c.isContact && c.premium && (
                <span className="premium-badge ml-2 bg-yellow-400 text-black px-1 rounded text-xs">
                  PREMIUM
                </span>
              )}

              {!c.isContact && (
                <span className="unknown-badge ml-2 bg-red-400 text-white px-1 rounded text-xs">
                  UNKNOWN
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-contacts">No contacts found.</p>
      )}
    </div>
  );
};

export default memo(ContactList);
