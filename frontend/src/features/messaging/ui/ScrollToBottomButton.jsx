import React from "react";
import { createPortal } from "react-dom";
import { FiArrowDown } from "react-icons/fi";
import "./ScrollToBottomButton.css";

export default function ScrollToBottomButton({
  visible = false,
  onClick = () => {},
  bottomOffset = 104,
  centerX = null,
  zIndex = 5,
}) {
  if (!visible || typeof document === "undefined") return null;

  const style = {
    bottom: `${bottomOffset}px`,
    left: centerX ? `${Math.round(centerX)}px` : "50%",
    zIndex,
  };

  return createPortal(
    <button
      type="button"
      className="scroll-bottom-fab"
      style={style}
      onClick={onClick}
      aria-label="Scroll to bottom"
    >
      <FiArrowDown size={20} />
    </button>,
    document.body
  );
}
