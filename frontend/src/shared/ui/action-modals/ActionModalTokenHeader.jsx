import React from "react";
import PropTypes from "prop-types";
import { useActionModalStyles } from "./useActionModalStyles.js";

const DEFAULT_FALLBACK_EMOJI = "🪙";
const DEFAULT_FALLBACK_IMG = "/tokens/default.svg";

export function ActionModalTokenHeader({
  meta = null,
  token,
  subtitle = undefined,
  conversionPrimary = null,
  conversionSecondary = null,
  icon = undefined,
  iconAlt = undefined,
  fallbackIcon = null,
  fallbackImageSrc = DEFAULT_FALLBACK_IMG,
  className = undefined,
  children = null,
  ...rest
}) {
  const styles = useActionModalStyles(meta);
  const logoStyle = styles.logoStyle;
  const logoInnerStyle = styles.logoInnerStyle;
  const resolvedIcon = icon || styles.icon || null;
  const resolvedSubtitle =
    subtitle ?? meta?.name ?? meta?.label ?? undefined;
  const fallbackEmoji =
    fallbackIcon != null ? fallbackIcon : DEFAULT_FALLBACK_EMOJI;
  const fallbackSrc = fallbackImageSrc || DEFAULT_FALLBACK_IMG;
  const classes = ["action-modal-token-header", className]
    .filter(Boolean)
    .join(" ");

  const handleImageError = (event) => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = fallbackSrc;
  };

  return (
    <div className={classes} {...rest}>
      <div className="action-modal-token-logo" style={logoStyle}>
        <span className="action-modal-token-logo-inner" style={logoInnerStyle}>
          {resolvedIcon ? (
            <img
              src={resolvedIcon}
              alt={iconAlt || token}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          ) : (
            <span style={{ fontSize: "1.5rem" }}>{fallbackEmoji}</span>
          )}
        </span>
      </div>

      <div className="action-modal-token-info">
        <p className="action-modal-token-name">{token}</p>
        {resolvedSubtitle && (
          <p className="action-modal-token-subtitle">{resolvedSubtitle}</p>
        )}
      </div>

      <div className="action-modal-token-conversion">
        <p className="action-modal-token-usd">
          {conversionPrimary != null ? conversionPrimary : "—"}
        </p>
        {conversionSecondary && (
          <p className="action-modal-token-action-text">
            {conversionSecondary}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

ActionModalTokenHeader.propTypes = {
  meta: PropTypes.shape({
    tint: PropTypes.string,
    glow: PropTypes.string,
    background: PropTypes.string,
    icon: PropTypes.string,
    name: PropTypes.string,
    label: PropTypes.string,
    iconScale: PropTypes.number,
  }),
  token: PropTypes.string.isRequired,
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  conversionPrimary: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.node,
  ]),
  conversionSecondary: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.node,
  ]),
  icon: PropTypes.string,
  iconAlt: PropTypes.string,
  fallbackIcon: PropTypes.node,
  fallbackImageSrc: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};
