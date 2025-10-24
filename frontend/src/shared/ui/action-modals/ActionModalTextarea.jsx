import React from "react";
import PropTypes from "prop-types";

/**
 * ActionModalTextarea - Textarea estándar para action modals
 * Aplica automáticamente los estilos de action-modals.css
 */
export function ActionModalTextarea({ className, ...rest }) {
  const classes = ["action-modal-textarea", className]
    .filter(Boolean)
    .join(" ");

  return <textarea className={classes} {...rest} />;
}

ActionModalTextarea.propTypes = {
  className: PropTypes.string,
};

