import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import { Search } from "lucide-react";

export const UiSearchInput = forwardRef(function UiSearchInput(
  {
    placeholder = "Search...",
    value,
    onChange,
    onKeyDown,
    onFocus,
    onBlur,
    className,
    icon: Icon = Search,
    iconSize = 18,
    iconStrokeWidth = 2.5,
    disabled = false,
    ...rest
  },
  ref
) {
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = (e) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const wrapperClasses = [
    "ui-search-input",
    isFocused && "ui-search-input--focused",
    disabled && "ui-search-input--disabled",
    className
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses}>
      <Icon 
        size={iconSize} 
        strokeWidth={iconStrokeWidth} 
        className="ui-search-input__icon" 
      />
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
        className="ui-search-input__field"
        {...rest}
      />
    </div>
  );
});

UiSearchInput.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  className: PropTypes.string,
  icon: PropTypes.elementType,
  iconSize: PropTypes.number,
  iconStrokeWidth: PropTypes.number,
  disabled: PropTypes.bool,
};

UiSearchInput.displayName = "UiSearchInput";

