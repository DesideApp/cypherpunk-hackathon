import React from "react";
import PropTypes from "prop-types";

/**
 * Botón Cancel para action modals (ghost style)
 * Copia EXACTA del estilo de BuyTokenModal
 */
export function ActionCancelButton({ onClick, disabled, children = "Cancel", ...props }) {
  const style = {
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
      onMouseEnter={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = "var(--text-secondary, #b5b5b5)";
          e.currentTarget.style.background = "transparent";
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
};

/**
 * Botón Back para action modals (secondary style)
 * Copia EXACTA del estilo de BuyTokenModal
 */
export function ActionBackButton({ onClick, disabled, children = "Back", ...props }) {
  const style = {
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
      onMouseEnter={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.borderColor = "color-mix(in srgb, var(--border-color) 80%, transparent)";
          e.currentTarget.style.background = "color-mix(in srgb, var(--window-background) 78%, transparent)";
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
};

/**
 * Botón primario para action modals
 * Copia EXACTA del estilo redondo de Cancel/Back pero con colores de action-color
 */
export function ActionPrimaryButton({ onClick, disabled, children, busy, busyText = "Processing…", ...props }) {
  const style = {
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

  const hoverStyle = !disabled ? {
    background: "var(--action-color-hover, #ff6b65)",
  } : {};

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      onMouseEnter={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--action-color, #fc554f)";
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
};

/**
 * Contenedor de botones para action modals footer
 * Replica la estructura exacta del footer de BuyTokenModal
 */
export function ActionButtons({ children, ...props }) {
  return (
    <div 
      style={{ 
        display: "flex", 
        justifyContent: "flex-end", 
        gap: "var(--action-modal-gap, 8px)", 
        flexWrap: "wrap" 
      }} 
      {...props}
    >
      {children}
    </div>
  );
}

ActionButtons.propTypes = {
  children: PropTypes.node,
};
