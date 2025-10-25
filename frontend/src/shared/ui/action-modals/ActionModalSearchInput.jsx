import React, { forwardRef } from "react";
import PropTypes from "prop-types";

/**
 * Search input specifically designed for action modals
 * Clean, minimal, no icon
 */
export const ActionModalSearchInput = forwardRef(function ActionModalSearchInput(
  {
    placeholder = "Search...",
    value,
    onChange,
    onKeyDown,
    onFocus,
    onBlur,
    className,
    disabled = false,
    ...rest
  },
  ref
) {
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = (e) => {
    console.log('[ActionModalSearchInput] Focus event');
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    console.log('[ActionModalSearchInput] Blur event');
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const wrapperClasses = [
    "action-modal-search-input",
    isFocused && "action-modal-search-input--focused",
    disabled && "action-modal-search-input--disabled",
    className
  ].filter(Boolean).join(" ");

  console.log('[ActionModalSearchInput] Classes:', wrapperClasses, 'isFocused:', isFocused);

  return (
    <div className={wrapperClasses}>
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        className="action-modal-search-input__field"
        {...rest}
      />
    </div>
  );
});

ActionModalSearchInput.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  className: PropTypes.string,
  disabled: PropTypes.bool,
};

ActionModalSearchInput.displayName = "ActionModalSearchInput";

