import React from "react";
import PropTypes from "prop-types";

/**
 * Generic modal shell using shared UI tokens.
 * It renders nothing when `open` is false.
 */
export function ModalShell({
  open = false,
  onClose,
  title,
  footer,
  children,
  labelledBy,
  size = "md",
  overlayProps = {},
  modalProps = {},
}) {
  const legacyIdRef = React.useRef(null);
  if (!legacyIdRef.current) {
    legacyIdRef.current = `ui-modal-title-${Math.random().toString(36).slice(2)}`;
  }
  const autoId = React.useId ? React.useId() : legacyIdRef.current;
  const titleId = typeof title === "string" ? labelledBy || autoId : labelledBy;

  if (!open) return null;

  const mergedOverlayProps = {
    className: ["ui-modal-overlay", overlayProps.className].filter(Boolean).join(" "),
    role: "presentation",
    ...overlayProps,
  };

  const mergedModalProps = {
    className: ["ui-modal", size === "lg" && "ui-modal--lg", modalProps.className]
      .filter(Boolean)
      .join(" "),
    role: "dialog",
    "aria-modal": true,
    ...(titleId ? { "aria-labelledby": titleId } : {}),
    ...modalProps,
  };

  return (
    <div {...mergedOverlayProps}>
      <div {...mergedModalProps}>
        {(title || onClose) && (
          <header className="ui-modal__header">
            {title && (
              typeof title === "string" ? (
                <h2 id={titleId} className="ui-modal__title">
                  {title}
                </h2>
              ) : (
                title
              )
            )}
            {onClose && (
              <button
                type="button"
                className="ui-button ui-button--ghost ui-modal__close"
                onClick={onClose}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            )}
          </header>
        )}

        <div className="ui-modal__body">{children}</div>

        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}

ModalShell.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  footer: PropTypes.node,
  children: PropTypes.node,
  labelledBy: PropTypes.string,
  size: PropTypes.oneOf(["md", "lg"]),
  overlayProps: PropTypes.object,
  modalProps: PropTypes.object,
};

ModalShell.defaultProps = {
  open: false,
  onClose: undefined,
  title: null,
  footer: null,
  children: null,
  labelledBy: undefined,
  size: "md",
  overlayProps: {},
  modalProps: {},
};
