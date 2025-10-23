import React from "react";
import PropTypes from "prop-types";

export function ActionModalCustomRow({
  left = null,
  right = null,
  children = null,
  className = undefined,
  ...rest
}) {
  const classes = ["action-modal-custom-row", className]
    .filter(Boolean)
    .join(" ");

  if (children) {
    return (
      <div className={classes} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div className={classes} {...rest}>
      {left}
      {right}
    </div>
  );
}

ActionModalCustomRow.propTypes = {
  left: PropTypes.node,
  right: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};
