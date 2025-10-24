import React from "react";
import PropTypes from "prop-types";
import { useActionModalStyles } from "./useActionModalStyles.js";

export function ActionModalCard({ meta = null, className, style, children, ...rest }) {
  const styles = useActionModalStyles(meta);
  const mergedStyle = styles.cardStyle
    ? { ...styles.cardStyle, ...style }
    : style;
  const classes = ["action-modal-card", className].filter(Boolean).join(" ");

  console.log('[ActionModalCard] Rendering with meta:', meta);
  console.log('[ActionModalCard] cardStyle:', styles.cardStyle);
  console.log('[ActionModalCard] mergedStyle:', mergedStyle);

  return (
    <div className={classes} style={mergedStyle} {...rest}>
      {children}
    </div>
  );
}

ActionModalCard.propTypes = {
  meta: PropTypes.shape({
    tint: PropTypes.string,
    glow: PropTypes.string,
    background: PropTypes.string,
    iconScale: PropTypes.number,
  }),
  className: PropTypes.string,
  style: PropTypes.object,
  children: PropTypes.node,
};
