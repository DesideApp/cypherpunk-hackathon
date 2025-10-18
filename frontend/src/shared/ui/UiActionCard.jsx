import React from "react";
import PropTypes from "prop-types";
import { UiChip } from "@shared/ui";

export const UiActionCard = ({
  // Basic props
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
  // Advanced props
  icon,
  iconStyle = {},
  quote,
  quoteCaption,
  stats = [], // [{ label, value, variant }]
  hint,
  className,
  children,
  ...rest
}) => {
  const wrapperClasses = [
    "ui-action-card-wrapper",
    className
  ].filter(Boolean).join(" ");

  const cardClasses = [
    "ui-action-card",
    className
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses} role="group" aria-label="Action card" {...rest}>
      <div className={cardClasses}>
        {/* Header */}
        {(title || date || type || icon) && (
          <header className="ui-action-card-header">
            <div className="ui-action-card-heading">
              {icon && (
                <span className="ui-action-card-icon" style={iconStyle}>
                  <span className="ui-action-card-icon-inner">
                    {typeof icon === "string" ? (
                      <img src={icon} alt={title || "Action"} />
                    ) : (
                      icon
                    )}
                  </span>
                </span>
              )}
              <div className="ui-action-card-titles">
                {title && <p className="ui-action-card-title">{title}</p>}
                {date && <span className="ui-action-card-date">{date}</span>}
              </div>
            </div>
            <div className="ui-action-card-header-right">
              {type && (
                <UiChip as="span" className="ui-action-card-type" role="presentation">
                  {type.toUpperCase()}
                </UiChip>
              )}
              {quote && (
                <div className="ui-action-card-quote">
                  <span className="ui-action-card-quote-value">{quote}</span>
                  {quoteCaption && (
                    <span className="ui-action-card-quote-caption">{quoteCaption}</span>
                  )}
                </div>
              )}
            </div>
          </header>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="ui-action-card-subtitle">{subtitle}</p>
        )}

        {/* Stats */}
        {stats.length > 0 && (
          <div className="ui-action-card-stats">
            {stats.map((stat, idx) => (
              <div 
                key={idx} 
                className={`ui-action-card-stat${stat.variant ? ` ui-action-card-stat--${stat.variant}` : ""}`}
              >
                <span className="ui-action-card-stat-label">{stat.label}</span>
                <span className={`ui-action-card-stat-value${stat.variant ? ` ui-action-card-stat-value--${stat.variant}` : ""}`}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
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

        {/* Hint */}
        {hint && (
          <p className="ui-action-card-hint">{hint}</p>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
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
  // Basic props
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
  // Advanced props
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  iconStyle: PropTypes.object,
  quote: PropTypes.string,
  quoteCaption: PropTypes.string,
  stats: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    variant: PropTypes.oneOf(["positive", "negative"]),
  })),
  hint: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

UiActionCard.displayName = "UiActionCard";

