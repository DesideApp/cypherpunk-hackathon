import React from "react";
import PropTypes from "prop-types";

export function ActionModalHint({ children, className = undefined, ...rest }) {
  const classes = ["action-modal-hint", className].filter(Boolean).join(" ");
  return (
    <p className={classes} {...rest}>
      {children}
    </p>
  );
}

ActionModalHint.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
