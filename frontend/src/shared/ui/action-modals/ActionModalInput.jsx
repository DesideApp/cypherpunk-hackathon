import React from "react";
import PropTypes from "prop-types";

/**
 * ActionModalInput - Input estándar para action modals
 * Aplica automáticamente los estilos de action-modals.css
 */
export function ActionModalInput({
  type = "text",
  compact = false,
  className,
  ...rest
}) {
  const classes = [
    "action-modal-input",
    compact && "action-modal-input--compact",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <input type={type} className={classes} {...rest} />;
}

ActionModalInput.propTypes = {
  type: PropTypes.string,
  compact: PropTypes.bool,
  className: PropTypes.string,
};

