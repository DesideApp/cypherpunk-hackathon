import React from "react";
import PropTypes from "prop-types";

/**
 * Botón Cancel para action modals (ghost style)
 * Copia EXACTA del estilo de BuyTokenModal
 */
export function ActionCancelButton({
  onClick,
  disabled,
  children = "Cancel",
  style: styleProp,
  className,
  ...props
}) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-sm, 8px)",
    borderRadius: "var(--radius-full, 999px)",
    padding: "10px 22px",
    fontSize: "0.95rem",
    fontWeight: "var(--font-caption-weight, 600)",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "var(--transition-all)",
    border: "1px solid transparent",
    textDecoration: "none",
    background: "transparent",
    color: "var(--text-secondary, #b5b5b5)",
    opacity: disabled ? 0.6 : 1,
  };
  const style = styleProp ? { ...baseStyle, ...styleProp } : baseStyle;

  const hoverStyle = !disabled ? {
    color: "var(--text-primary, #f5f5f5)",
    background: "var(--hover-overlay, rgba(224, 222, 217, 0.08))",
  } : {};

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={className}
      onMouseEnter={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, style);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

ActionCancelButton.propTypes = {
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  children: PropTypes.node,
  style: PropTypes.object,
  className: PropTypes.string,
};

/**
 * Botón Back para action modals (secondary style)
 * Copia EXACTA del estilo de BuyTokenModal
 */
export function ActionBackButton({
  onClick,
  disabled,
  children = "Back",
  style: styleProp,
  className,
  ...props
}) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-sm, 8px)",
    borderRadius: "var(--radius-full, 999px)",
    padding: "10px 22px",
    fontSize: "0.95rem",
    fontWeight: "var(--font-caption-weight, 600)",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "var(--transition-all)",
    border: "1px solid color-mix(in srgb, var(--border-color) 80%, transparent)",
    background: "color-mix(in srgb, var(--window-background) 78%, transparent)",
    color: "var(--text-secondary)",
    textDecoration: "none",
    opacity: disabled ? 0.6 : 1,
  };
  const style = styleProp ? { ...baseStyle, ...styleProp } : baseStyle;

  const hoverStyle = !disabled ? {
    color: "var(--text-primary)",
    borderColor: "var(--border-color-active)",
    background: "color-mix(in srgb, var(--background-color) 82%, transparent)",
  } : {};

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={className}
      onMouseEnter={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, style);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

ActionBackButton.propTypes = {
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  children: PropTypes.node,
  style: PropTypes.object,
  className: PropTypes.string,
};

/**
 * Botón primario para action modals
 * Copia EXACTA del estilo redondo de Cancel/Back pero con colores de action-color
 */
export function ActionPrimaryButton({
  onClick,
  disabled,
  children,
  busy,
  busyText = "Processing…",
  style: styleProp,
  className,
  ...props
}) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-sm, 8px)",
    borderRadius: "var(--radius-full, 999px)",
    padding: "10px 22px",
    fontSize: "0.95rem",
    fontWeight: "var(--font-caption-weight, 600)",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "var(--transition-all)",
    border: "none",
    textDecoration: "none",
    background: "var(--action-color, #fc554f)",
    color: "var(--sent-text, #ffffff)",
    boxShadow: "none",
    opacity: disabled ? 0.6 : 1,
  };
  const style = styleProp ? { ...baseStyle, ...styleProp } : baseStyle;

  const hoverStyle = !disabled ? {
    background: "var(--action-color-hover, #ff6b65)",
  } : {};

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={className}
      onMouseEnter={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, style);
        }
      }}
      {...props}
    >
      {busy ? busyText : children}
    </button>
  );
}

ActionPrimaryButton.propTypes = {
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  children: PropTypes.node.isRequired,
  busy: PropTypes.bool,
  busyText: PropTypes.string,
  style: PropTypes.object,
  className: PropTypes.string,
};

/**
 * Contenedor de botones para action modals footer
 * Replica la estructura exacta del footer de BuyTokenModal
 */
export function ActionButtons({ children, style: styleProp, className, ...props }) {
  const baseStyle = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "var(--action-modal-gap, 8px)",
    flexWrap: "wrap",
  };
  const style = styleProp ? { ...baseStyle, ...styleProp } : baseStyle;

  return (
    <div style={style} className={className} {...props}>
      {children}
    </div>
  );
}

ActionButtons.propTypes = {
  children: PropTypes.node,
  style: PropTypes.object,
  className: PropTypes.string,
};
