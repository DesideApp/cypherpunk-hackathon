import React from "react";
import PropTypes from "prop-types";

/**
 * ActionModalField - Wrapper para labels + inputs/selects/textareas
 * Maneja label, input y texto de ayuda de forma consistente
 */
export function ActionModalField({
  label,
  help,
  required = false,
  children,
  className,
  ...rest
}) {
  const classes = ["action-modal-field", className].filter(Boolean).join(" ");

  return (
    <label className={classes} {...rest}>
      {label && (
        <span className="action-modal-field-label">
          {label}
          {required && <span style={{ color: "var(--color-error)" }}> *</span>}
        </span>
      )}
      {children}
      {help && (
        <small className="action-modal-field-help">{help}</small>
      )}
    </label>
  );
}

ActionModalField.propTypes = {
  label: PropTypes.string,
  help: PropTypes.string,
  required: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

