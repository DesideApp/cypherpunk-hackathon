import React from "react";
import PropTypes from "prop-types";
import { UiChip } from "@shared/ui";

export const UiActionCard = ({
  variant = "simple", // simple, premium, compact
  status = "completed", // pending, completed, error
  layout = "vertical", // horizontal, vertical
  sender = "own", // own, contact
  title,
  subtitle,
  date,
  type,
  meta = [], // [{ label, value }]
  note,
  quickActions = [], // [{ label, multiplier, onClick }]
  primaryAction,
  secondaryAction,
  explorerUrl,
  className,
  children,
  ...rest
}) => {
  const wrapperClasses = [
    "ui-action-card-wrapper",
    `ui-action-card-wrapper--${sender}`,
    `ui-action-card-wrapper--${layout}`,
    className
  ].filter(Boolean).join(" ");

  const cardClasses = [
    "ui-action-card",
    `ui-action-card--${variant}`,
    `ui-action-card--${status}`,
    `ui-action-card--${sender}`,
    `ui-action-card--${layout}`
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses} role="group" aria-label="Action card" {...rest}>
      <div className={cardClasses}>
        {/* Header */}
        {(title || date || type) && (
          <header className="ui-action-card-header">
            <div className="ui-action-card-heading">
              {title && <p className="ui-action-card-title">{title}</p>}
              {date && <span className="ui-action-card-date">{date}</span>}
            </div>
            {type && (
              <UiChip as="span" className="ui-action-card-type" role="presentation">
                {type.toUpperCase()}
              </UiChip>
            )}
          </header>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="ui-action-card-subtitle">{subtitle}</p>
        )}

        {/* Meta information */}
        {meta.length > 0 && (
          <div className="ui-action-card-meta">
            {meta.map(({ label, value }, idx) => (
              <React.Fragment key={`${label}-${idx}`}>
                <span className="ui-action-card-meta-label">{label}</span>
                <span className="ui-action-card-meta-value">{value}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Note */}
        {note && (
          <p className="ui-action-card-note">{note}</p>
        )}

        {/* Quick Actions (only for contact sender) */}
        {sender === "contact" && quickActions.length > 0 && (
          <div className="ui-action-card-quick-actions">
            {quickActions.map(({ label, multiplier, onClick }, idx) => (
              <button
                key={idx}
                type="button"
                className="ui-action-card-quick-action"
                onClick={onClick}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Custom content */}
        {children}

        {/* Footer */}
        {(primaryAction || secondaryAction || explorerUrl) && (
          <footer className="ui-action-card-footer">
            {primaryAction && (
              <button
                type="button"
                className="ui-action-card-primary"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
              >
                {primaryAction.label}
              </button>
            )}
            {secondaryAction && (
              <button
                type="button"
                className="ui-action-card-secondary"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.label}
              </button>
            )}
            {explorerUrl && (
              <a
                className="ui-action-card-secondary"
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver tx ↗
              </a>
            )}
          </footer>
        )}
      </div>
    </div>
  );
};

UiActionCard.propTypes = {
  variant: PropTypes.oneOf(["simple", "premium", "compact"]),
  status: PropTypes.oneOf(["pending", "completed", "error"]),
  layout: PropTypes.oneOf(["horizontal", "vertical"]),
  sender: PropTypes.oneOf(["own", "contact"]),
  title: PropTypes.string,
  subtitle: PropTypes.string,
  date: PropTypes.string,
  type: PropTypes.string,
  meta: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })),
  note: PropTypes.string,
  quickActions: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    multiplier: PropTypes.number,
    onClick: PropTypes.func.isRequired,
  })),
  primaryAction: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  }),
  secondaryAction: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  }),
  explorerUrl: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

UiActionCard.displayName = "UiActionCard";

