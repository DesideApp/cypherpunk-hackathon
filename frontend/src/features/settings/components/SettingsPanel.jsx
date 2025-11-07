import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { UiSearchInput } from '@shared/ui';
import { fetchRelayUsage, purgeRelayMailbox } from '@features/settings/services/relayUsageService.js';
import './SettingsPanel.css';

export default function SettingsPanel({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState(null);
  const [purging, setPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState(null);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const data = await fetchRelayUsage();
      setUsage(data);
      setUsageError(null);
    } catch (error) {
      setUsageError(error?.message || 'Failed to load relay usage');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const handlePurge = useCallback(async (fraction = 1) => {
    if (purging) return;
    setPurging(true);
    setPurgeMessage(null);
    try {
      await purgeRelayMailbox({ target: 'both', fraction });
      const percent = fraction >= 1 ? '100%' : `${Math.round(fraction * 100)}%`;
      setPurgeMessage({
        type: 'success',
        text: `Freed ${percent} of your mailbox & vault. Usage will refresh shortly.`,
      });
      await loadUsage();
    } catch (error) {
      setPurgeMessage({ type: 'error', text: error?.message || 'Failed to purge mailbox' });
    } finally {
      setPurging(false);
    }
  }, [purging, loadUsage]);

  const handleUpgrade = useCallback(() => {
    window.open('/premium', '_blank', 'noopener');
  }, []);

  const relayUsage = usage
    ? {
        used: usage.usedBytes ?? 0,
        quota: usage.quotaBytes ?? 0,
        status: usage.usageStatus || 'ok',
        ratio: usage.usageRatio ?? 0,
        grace: usage.grace || null,
      }
    : null;

  const vaultUsage = usage?.vault
    ? {
        used: usage.vault.usedBytes ?? 0,
        quota: usage.vault.quotaBytes ?? 0,
        status: usage.vault.usageStatus || 'ok',
        ratio: usage.vault.usageRatio ?? 0,
      }
    : null;

  const showGraceAlert = Boolean(relayUsage?.grace?.isInGrace);

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
            <h3 className="settings-section-title">Relay usage</h3>
            {usageLoading ? (
              <p className="settings-placeholder">Loading usage…</p>
            ) : usageError ? (
              <p className="settings-placeholder settings-placeholder--error">{usageError}</p>
            ) : (
              <UsageCard
                relayUsage={relayUsage}
                vaultUsage={vaultUsage}
                showGraceAlert={showGraceAlert}
                purgeMessage={purgeMessage}
                onPurge={handlePurge}
                onUpgrade={handleUpgrade}
                purging={purging}
              />
            )}
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Notifications</h3>
            <p className="settings-placeholder">Coming soon…</p>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Privacy</h3>
            <p className="settings-placeholder">Coming soon…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / (1024 ** idx);
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

function statusVariant(status, isGrace) {
  if (isGrace) return 'grace';
  if (status === 'critical') return 'critical';
  if (status === 'warning') return 'warning';
  return 'ok';
}

function UsageCard({ relayUsage, vaultUsage, showGraceAlert, purgeMessage, onPurge, onUpgrade, purging }) {
  const limitBytes = relayUsage?.grace?.enabled
    ? relayUsage.grace.limitBytes
    : relayUsage?.quota || 0;
  const relayPercent = limitBytes > 0 ? Math.min(100, (relayUsage.used / limitBytes) * 100) : 0;
  const quotaPercent = relayUsage?.quota > 0 && limitBytes > 0
    ? Math.min(100, (relayUsage.quota / limitBytes) * 100)
    : null;

  const vaultPercent = vaultUsage?.quota > 0 ? Math.min(100, (vaultUsage.used / vaultUsage.quota) * 100) : 0;

  const graceDescription = relayUsage?.grace?.enabled
    ? `+${relayUsage.grace.percentage}% grace (${formatBytes(relayUsage.grace.limitBytes)} max)`
    : null;

  return (
    <div className="usage-card">
      <div className="usage-row">
        <div>
          <p className="usage-label">Relay mailbox</p>
          <p className="usage-value">
            {formatBytes(relayUsage?.used)} / {formatBytes(relayUsage?.quota)}
          </p>
        </div>
        <span className={`usage-chip usage-chip--${statusVariant(relayUsage?.status, showGraceAlert)}`}>
          {showGraceAlert ? 'Grace' : relayUsage?.status ?? 'ok'}
        </span>
      </div>

      <div className="usage-progress" role="progressbar" aria-valuenow={relayPercent} aria-valuemin="0" aria-valuemax="100">
        <div className="usage-progress__bar" style={{ width: `${relayPercent}%` }} />
        {quotaPercent != null && (
          <span className="usage-progress__marker" style={{ left: `${quotaPercent}%` }} />
        )}
      </div>

      {graceDescription && (
        <p className="usage-meta">{graceDescription}</p>
      )}

      <div className="usage-row usage-row--muted">
        <div>
          <p className="usage-label">Attachment vault</p>
          <p className="usage-value">
            {formatBytes(vaultUsage?.used ?? 0)} / {formatBytes(vaultUsage?.quota ?? 0)}
          </p>
        </div>
        <span className={`usage-chip usage-chip--${statusVariant(vaultUsage?.status)}`}>
          {vaultUsage?.status ?? 'ok'}
        </span>
      </div>

      <div className="usage-progress usage-progress--subtle" role="progressbar" aria-valuenow={vaultPercent} aria-valuemin="0" aria-valuemax="100">
        <div className="usage-progress__bar usage-progress__bar--subtle" style={{ width: `${vaultPercent}%` }} />
      </div>

      {showGraceAlert && (
        <div className="usage-alert">
          <p className="usage-alert__title">Grace mode active</p>
          <p className="usage-alert__text">
            You can keep sending Actions and text messages, but large attachments are limited until you
            free up space or upgrade your plan.
          </p>
        </div>
      )}

      {purgeMessage && (
        <div className={`usage-feedback usage-feedback--${purgeMessage.type}`}>
          {purgeMessage.text}
        </div>
      )}

      <div className="usage-purge-options">
        {[0.25, 0.5, 1].map((fraction) => (
          <button
            type="button"
            key={fraction}
            className="usage-button usage-button--ghost"
            onClick={() => onPurge(fraction)}
            disabled={purging}
          >
            {purging ? '...' : `Free up ${Math.round(fraction * 100)}%`}
          </button>
        ))}
      </div>

      <div className="usage-cta">
        <button
          type="button"
          className="usage-button usage-button--ghost"
          onClick={() => onPurge(1)}
          disabled={purging}
        >
          {purging ? 'Purging…' : 'Purge 100%'}
        </button>
        <button type="button" className="usage-button usage-button--primary" onClick={onUpgrade}>
          Upgrade plan
        </button>
      </div>
    </div>
  );
}
