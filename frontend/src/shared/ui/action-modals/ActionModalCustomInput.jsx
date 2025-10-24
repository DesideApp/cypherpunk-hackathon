import React from "react";
import PropTypes from "prop-types";

/**
 * ActionModalCustomInput - Input específico para custom amounts
 * Diseñado para ir en el lado izquierdo de ActionModalCustomRow
 */
export function ActionModalCustomInput({ className, ...rest }) {
  const classes = ["action-modal-custom-input", className]
    .filter(Boolean)
    .join(" ");

  return <input type="number" className={classes} {...rest} />;
}

ActionModalCustomInput.propTypes = {
  className: PropTypes.string,
};

