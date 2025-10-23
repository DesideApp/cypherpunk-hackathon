import React from "react";
import PropTypes from "prop-types";

export function UiCard({ as: Component = "div", elevated = false, className, children, ...rest }) {
  const classes = ["ui-card", elevated && "ui-card--elevated", className].filter(Boolean).join(" ");
  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}

UiCard.propTypes = {
  as: PropTypes.elementType,
  elevated: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};
