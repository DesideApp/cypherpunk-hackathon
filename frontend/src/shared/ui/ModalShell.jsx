import React from "react";
import PropTypes from "prop-types";
import "./actionmodals.css";

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
  showCloseButton = false,
  overlayProps = {},
  modalProps = {},
}) {
  const legacyIdRef = React.useRef(null);
  if (!legacyIdRef.current) {
    legacyIdRef.current = `ui-modal-title-${Math.random().toString(36).slice(2)}`;
  }

  React.useEffect(() => {
    if (!open || typeof onClose !== "function") return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);
  
  // Hook must be called unconditionally - always call useId if available
  const reactId = React.useId?.() || null;
  const autoId = reactId || legacyIdRef.current;
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
        {(title || (onClose && showCloseButton)) && (
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
            {onClose && showCloseButton && (
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
  showCloseButton: PropTypes.bool,
  overlayProps: PropTypes.object,
  modalProps: PropTypes.object,
};
