import React from "react";
import PropTypes from "prop-types";

/**
 * ActionModalToggle - Toggle/RadioGroup para opciones mutuamente excluyentes
 * Usado para switches como "I pay" vs "They pay" en AgreementModal
 */
export function ActionModalToggle({
  options = [],
  value,
  onChange,
  disabled = false,
  className,
  ...rest
}) {
  const classes = ["action-modal-toggle", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role="radiogroup" {...rest}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const buttonClass = [
          "action-modal-toggle-button",
          isSelected && "action-modal-toggle-button--active",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={option.value}
            type="button"
            className={buttonClass}
            onClick={() => onChange?.(option.value)}
            disabled={disabled}
            aria-pressed={isSelected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

ActionModalToggle.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.node.isRequired,
    })
  ),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

