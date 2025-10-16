import React from "react";
import { Sun, Moon } from "lucide-react";
import { useLayout } from "@features/layout/contexts/LayoutContext";
import "./ThemeToggle.css";

/**
 * ThemeToggle
 * - Control único de tema (usa LayoutContext).
 * - Variantes:
 *    • variant="switch" (por defecto) → pill de 28x14 con thumb deslizante.
 *    • variant="button"               → botón con icono + label (Light/Dark).
 *    • variant="icon"                 → solo icono (ultra compacto).
 *
 * Props:
 *  - variant?: "switch" | "button" | "icon"
 *  - className?: string
 *  - title?: string (override del tooltip)
 */
export default function ThemeToggle({ variant = "switch", className = "", title }) {
  let theme = "light";
  let toggleTheme = null;

  try {
    const ctx = useLayout();
    theme = ctx?.theme || theme;
    toggleTheme = ctx?.toggleTheme || null;
  } catch {
    // Fallback sin LayoutContext
  }

  const isDark = theme === "dark";
  const next = isDark ? "light" : "dark";
  const handleToggle = () => {
    if (toggleTheme) return toggleTheme();
    // Fallback: alterna data-theme en <html>
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") || "light";
    root.setAttribute("data-theme", current === "dark" ? "light" : "dark");
  };

  if (variant === "button") {
    return (
      <button
        className={`themetoggle themetoggle--button ${className}`}
        onClick={handleToggle}
        aria-label={`Switch to ${next} theme`}
        title={title || `Switch to ${next} theme`}
      >
        <span className="themetoggle__icon" aria-hidden="true">
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </span>
        <span className="themetoggle__label">{isDark ? "Light" : "Dark"}</span>
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <button
        className={`themetoggle themetoggle--icon ${className}`}
        onClick={handleToggle}
        aria-label={`Switch to ${next} theme`}
        title={title || `Switch to ${next} theme`}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    );
  }

  // variant === "switch"
  return (
    <button
      className={`themetoggle themetoggle--switch ${isDark ? "is-dark" : ""} ${className}`}
      onClick={handleToggle}
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${next} theme`}
      title={title || `Switch to ${next} theme`}
    >
      <span className="themetoggle__track" aria-hidden="true">
        <span className="themetoggle__thumb" />
      </span>
    </button>
  );
}
