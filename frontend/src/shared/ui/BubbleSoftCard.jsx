import React from "react";
import PropTypes from "prop-types";
import "./bubbleSoftCard.css";

const buildClassName = (...parts) =>
  parts.filter((part) => typeof part === "string" && part.trim().length > 0).join(" ");

export default function BubbleSoftCard({
  variant = "received",
  stripe = true,
  accentColor = null,
  className = "",
  style = null,
  children,
  ...rest
}) {
  const classes = buildClassName(
    "bubble-soft-card",
    variant ? `bubble-soft-card--${variant}` : "",
    stripe ? "" : "bubble-soft-card--no-stripe",
    className
  );

  const mergedStyle =
    accentColor || style
      ? {
          ...(style || {}),
          ...(accentColor ? { "--bubble-soft-card-stripe-color": accentColor } : {}),
        }
      : undefined;

  return (
    <div className={classes} style={mergedStyle} {...rest}>
      {stripe && <span className="bubble-soft-card__stripe" aria-hidden="true" />}
      <div className="bubble-soft-card__surface">
        {children}
      </div>
    </div>
  );
}

BubbleSoftCard.propTypes = {
  variant: PropTypes.oneOf(["received", "sent", "neutral"]),
  stripe: PropTypes.bool,
  accentColor: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  children: PropTypes.node,
};
