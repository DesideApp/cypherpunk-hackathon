// src/features/messaging/ui/SearchModal.jsx
import React, { useState, useRef, useEffect } from "react";
import { UiSearchInput } from "@shared/ui";
import { X } from "lucide-react";
import "./SearchModal.css";

const SearchModal = ({ messages = [], onClose, onSelectMessage }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    // Focus input al abrir
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered = messages.filter((msg) => {
      const text = msg.text || msg.content || "";
      return text.toLowerCase().includes(searchTerm);
    });

    setResults(filtered);
  }, [query, messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "";
    const date = new Date(ts);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const truncateText = (text, maxLength = 80) => {
    if (!text) return "";
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  };

  return (
    <div className="search-panel" ref={panelRef}>
      <div className="search-panel-input-wrapper">
        <UiSearchInput
          ref={inputRef}
          placeholder="Search messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="search-panel-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {query.trim() && (
        <div className="search-panel-results">
          {results.length === 0 ? (
            <p className="search-panel-empty">No messages found</p>
          ) : (
            <>
              <p className="search-panel-count">{results.length} result{results.length !== 1 ? 's' : ''}</p>
              <div className="search-results-list">
                {results.map((msg, index) => (
                  <div
                    key={msg.id || index}
                    className="search-result-item"
                    onClick={() => {
                      onSelectMessage(msg);
                      onClose();
                    }}
                  >
                    <div className="search-result-text">
                      {truncateText(msg.text || msg.content)}
                    </div>
                    <div className="search-result-meta">
                      {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchModal;

