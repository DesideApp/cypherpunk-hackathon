import React from "react";
import PropTypes from "prop-types";

/**
 * ActionModalSelect - Select estándar para action modals
 * Aplica automáticamente los estilos de action-modals.css
 */
export function ActionModalSelect({ className, children, ...rest }) {
  const classes = ["action-modal-select", className]
    .filter(Boolean)
    .join(" ");

  return (
    <select className={classes} {...rest}>
      {children}
    </select>
  );
}

ActionModalSelect.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

