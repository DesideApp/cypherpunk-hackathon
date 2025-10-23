import React from "react";
import PropTypes from "prop-types";

const VARIANTS = ["primary", "secondary", "ghost", "danger"];
const SIZES = ["sm", "md", "lg"];

export const UiButton = React.forwardRef(function UiButton(
  {
    as: Component = "button",
    type = Component === "button" ? "button" : undefined,
    variant = "primary",
    size = "md",
    block = false,
    className,
    children,
    ...rest
  },
  ref
) {
  const variantClass = VARIANTS.includes(variant) ? `ui-button--${variant}` : null;
  const sizeClass =
    size !== "md" && SIZES.includes(size) ? `ui-button--${size}` : null;

  const classes = ["ui-button", variantClass, sizeClass, block && "ui-button--block", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component ref={ref} type={type} className={classes} {...rest}>
      {children}
    </Component>
  );
});

UiButton.propTypes = {
  as: PropTypes.elementType,
  type: PropTypes.string,
  variant: PropTypes.oneOf(VARIANTS),
  size: PropTypes.oneOf(SIZES),
  block: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};
