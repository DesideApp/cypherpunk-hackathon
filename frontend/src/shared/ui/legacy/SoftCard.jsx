import React from "react";
import PropTypes from "prop-types";
import "./softcard.css";

const buildClassName = (...parts) =>
  parts.filter((part) => typeof part === "string" && part.trim().length > 0).join(" ");

export default function SoftCard({
  variant = "neutral",
  accentColor = null,
  className = "",
  children,
  ...rest
}) {
  const classes = buildClassName(
    "soft-card",
    variant ? `soft-card--${variant}` : "",
    className
  );

  const style = accentColor
    ? { "--soft-card-accent": accentColor, ...(rest.style || {}) }
    : rest.style;

  return (
    <div className={classes} style={style} {...rest}>
      <span className="soft-card__accent" aria-hidden="true" />
      <div className="soft-card__content">
        {children}
      </div>
    </div>
  );
}

SoftCard.propTypes = {
  variant: PropTypes.oneOf(["neutral", "own", "contact", "success", "error"]),
  accentColor: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};
