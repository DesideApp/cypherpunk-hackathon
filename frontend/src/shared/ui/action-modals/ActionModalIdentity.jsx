import React from "react";
import PropTypes from "prop-types";

const DEFAULT_AVATAR_FALLBACK = "👤";

export function ActionModalIdentity({
  title = null,
  subtitle = null,
  loading = false,
  titlePlaceholder = (
    <span className="skeleton skeleton--text" aria-hidden="true">
      Loading…
    </span>
  ),
  subtitlePlaceholder = null,
  avatar,
  avatarLabel,
  avatarFallback = DEFAULT_AVATAR_FALLBACK,
  className,
  ...rest
}) {
  const resolvedTitle =
    loading && titlePlaceholder != null
      ? titlePlaceholder
      : title ?? titlePlaceholder;

  const resolvedSubtitle =
    loading && subtitlePlaceholder != null
      ? subtitlePlaceholder
      : subtitle ?? subtitlePlaceholder;

  const classes = ["action-modal-party", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      <div
        className="action-modal-avatar action-modal-avatar--small"
        aria-label={avatarLabel}
      >
        {avatar || avatarFallback || DEFAULT_AVATAR_FALLBACK}
      </div>
      <div className="action-modal-identity-info">
        <p className="action-modal-identity-name">{resolvedTitle}</p>
        {resolvedSubtitle && (
          <p className="action-modal-identity-address">{resolvedSubtitle}</p>
        )}
      </div>
    </div>
  );
}

ActionModalIdentity.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  loading: PropTypes.bool,
  titlePlaceholder: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  subtitlePlaceholder: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  avatar: PropTypes.node,
  avatarLabel: PropTypes.string,
  avatarFallback: PropTypes.node,
  className: PropTypes.string,
};
