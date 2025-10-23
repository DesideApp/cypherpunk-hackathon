import React from "react";
import PropTypes from "prop-types";

export function UiChip({
  selected = false,
  className,
  as: Component = "button",
  children,
  ...rest
}) {
  const classes = ["ui-chip", selected && "ui-chip--selected", className].filter(Boolean).join(" ");
  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}

UiChip.propTypes = {
  selected: PropTypes.bool,
  className: PropTypes.string,
  as: PropTypes.elementType,
  children: PropTypes.node,
};
