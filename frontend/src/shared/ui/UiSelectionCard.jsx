import React from "react";
import PropTypes from "prop-types";

/**
 * Generic selection card component based on buy-token styles
 * Used for cards that allow users to select from options
 */
export const UiSelectionCard = ({
  icon,
  iconStyle = {},
  title,
  subtitle,
  price,
  badge,
  disabled = false,
  onClick,
  className,
  children,
  ...rest
}) => {
  const cardClasses = [
    "ui-selection-card",
    disabled && "ui-selection-card--disabled",
    className
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={cardClasses}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {/* Icon */}
      {icon && (
        <div className="ui-selection-card__icon" style={iconStyle}>
          <div className="ui-selection-card__icon-inner">
            {typeof icon === "string" ? (
              <img src={icon} alt={title || "Selection option"} />
            ) : (
              icon
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="ui-selection-card__content">
        <div className="ui-selection-card__title">{title}</div>
        {subtitle && (
          <div className="ui-selection-card__subtitle">{subtitle}</div>
        )}
        {price && (
          <div className="ui-selection-card__price">{price}</div>
        )}
        {badge && (
          <div className="ui-selection-card__badge">{badge}</div>
        )}
      </div>

      {/* Custom content */}
      {children}
    </button>
  );
};

UiSelectionCard.propTypes = {
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  iconStyle: PropTypes.object,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  price: PropTypes.string,
  badge: PropTypes.string,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
  children: PropTypes.node,
};

UiSelectionCard.displayName = "UiSelectionCard";


