import React from "react";
import PropTypes from "prop-types";

export function ActionModalPresetAmounts({
  amounts = [],
  selected = null,
  onSelect = undefined,
  disabled = false,
  formatAmount = undefined,
  className = undefined,
  buttonProps = undefined,
}) {
  const classes = ["action-modal-amounts", className]
    .filter(Boolean)
    .join(" ");
  const format =
    typeof formatAmount === "function" ? formatAmount : (value) => value;

  return (
    <div className={classes}>
      {amounts.map((value) => {
        const isSelected =
          selected != null &&
          (typeof selected === "number"
            ? Number(selected) === Number(value)
            : String(selected) === String(value));
        const buttonClass = [
          "action-modal-amount-button",
          isSelected && "selected",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={value}
            type="button"
            className={buttonClass}
            disabled={disabled}
            onClick={() => onSelect?.(value)}
            {...buttonProps}
          >
            {format(value)}
          </button>
        );
      })}
    </div>
  );
}

ActionModalPresetAmounts.propTypes = {
  amounts: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  ),
  selected: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSelect: PropTypes.func,
  disabled: PropTypes.bool,
  formatAmount: PropTypes.func,
  className: PropTypes.string,
  buttonProps: PropTypes.object,
};
