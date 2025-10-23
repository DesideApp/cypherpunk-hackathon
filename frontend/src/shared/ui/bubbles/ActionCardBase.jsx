import React from "react";
import PropTypes from "prop-types";
import BubbleSoftCard from "../BubbleSoftCard.jsx";
import "./bubbles.css";

const buildClassName = (...parts) =>
  parts.filter((part) => typeof part === "string" && part.trim().length > 0).join(" ");

export default function ActionCardBase({
  variant = "contact",
  title = null,
  date = null,
  subtitle = null,
  chip = null,
  metaRows = [],
  meta = null,
  body = null,
  footer = null,
  children = null,
  className = "",
  headerClassName = "",
  headingClassName = "",
  subtitleClassName = "",
  metaClassName = "",
  bodyClassName = "",
  footerClassName = "",
  role = "group",
  ariaLabel = "",
}) {
  const variantClass =
    variant === "own" || variant === "contact"
      ? `bubble-action-card--${variant}`
      : variant
        ? `bubble-action-card--${variant}`
        : "bubble-action-card--contact";

  const containerClassName = buildClassName("bubble-action-card", variantClass, className);
  const bubbleVariant =
    variant === "own" || variant === "sent"
      ? "sent"
      : variant === "contact" || variant === "received"
        ? "received"
        : "neutral";
  const resolvedBody = body ?? children;

  const renderMeta = () => {
    if (meta) {
      return (
        <div className={buildClassName("bubble-action-card__meta", metaClassName)}>
          {meta}
        </div>
      );
    }

    if (!Array.isArray(metaRows) || metaRows.length === 0) {
      return null;
    }

    return (
      <div className={buildClassName("bubble-action-card__meta", metaClassName)}>
        {metaRows.map(
          (
            {
              id,
              label = null,
              labelClassName: rowLabelClass = "",
              value = null,
              valueClassName: rowValueClass = "",
              link = null,
            },
            index
          ) => {
            const key = id ?? `${label || "meta"}-${index}`;

            return (
              <React.Fragment key={key}>
                {label !== null && (
                  <span
                    className={buildClassName(
                      "bubble-action-card__meta-label",
                      rowLabelClass
                    )}
                  >
                    {label}
                  </span>
                )}
                {link ? (
                  <a
                    className={buildClassName(
                      "bubble-action-card__meta-value",
                      rowValueClass
                    )}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {value}
                  </a>
                ) : (
                  <span
                    className={buildClassName(
                      "bubble-action-card__meta-value",
                      rowValueClass
                    )}
                  >
                    {value}
                  </span>
                )}
              </React.Fragment>
            );
          }
        )}
      </div>
    );
  };

  return (
    <article
      className={containerClassName}
      role={role}
      aria-label={ariaLabel || undefined}
    >
      {(title || date || chip) && (
        <header className={buildClassName("bubble-action-card__header", headerClassName)}>
          <div className={buildClassName("bubble-action-card__heading", headingClassName)}>
            {title && (
              <p className="bubble-action-card__title">
                {title}
              </p>
            )}
            {date && <span className="bubble-action-card__date">{date}</span>}
          </div>
          {chip && <span className="bubble-action-card__chip">{chip}</span>}
        </header>
      )}

      <div className="bubble-action-card__body-wrap">
        <BubbleSoftCard variant={bubbleVariant} stripe={false}>
          {subtitle && (
            <p className={buildClassName("bubble-action-card__subtitle", subtitleClassName)}>
              {subtitle}
            </p>
          )}

          {renderMeta()}

          {resolvedBody && (
            <div className={buildClassName("bubble-action-card__body", bodyClassName)}>
              {resolvedBody}
            </div>
          )}

          {footer && (
            <footer className={buildClassName("bubble-action-card__footer", footerClassName)}>
              {footer}
            </footer>
          )}
        </BubbleSoftCard>
      </div>
    </article>
  );
}

ActionCardBase.propTypes = {
  variant: PropTypes.string,
  title: PropTypes.node,
  date: PropTypes.node,
  subtitle: PropTypes.node,
  chip: PropTypes.node,
  metaRows: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.node,
      labelClassName: PropTypes.string,
      value: PropTypes.node,
      valueClassName: PropTypes.string,
      link: PropTypes.string,
    })
  ),
  meta: PropTypes.node,
  body: PropTypes.node,
  footer: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  headingClassName: PropTypes.string,
  subtitleClassName: PropTypes.string,
  metaClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footerClassName: PropTypes.string,
  role: PropTypes.string,
  ariaLabel: PropTypes.string,
};
