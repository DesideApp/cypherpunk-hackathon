/**
 * Design tokens helpers.
 * All values reference CSS custom properties so they stay in sync with the active theme.
 */

export const spacing = Object.freeze({
  xs: "var(--space-xs)",
  sm: "var(--space-sm)",
  md: "var(--space-md)",
  lg: "var(--space-lg)",
  xl: "var(--space-xl)",
  "2xl": "var(--space-2xl)",
});

export const radius = Object.freeze({
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  full: "var(--radius-full)",
});

export const colors = Object.freeze({
  background: "var(--background-color)",
  modalBackground: "var(--modal-background, var(--modal-surface, var(--background-color)))",
  modalSurface: "var(--modal-surface, var(--modal-background, var(--background-color)))",
  window: "var(--window-background)",
  surface: "var(--surface-color)",
  surfacePure: "var(--surface-pure)",
  border: "var(--border-color)",
  borderActive: "var(--border-color-active)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  accent: "var(--accent-color)",
  accentStrong: "var(--accent-color-strong)",
  success: "var(--success-color)",
  warning: "var(--warning-color)",
  error: "var(--error-color)",
  hoverOverlay: "var(--hover-overlay)",
  activeOverlay: "var(--active-overlay)",
  overlayHeavy: "var(--overlay-dark-heavy)",
  overlayMedium: "var(--overlay-dark-medium)",
  overlayLight: "var(--overlay-dark-light)",
});

export const shadows = Object.freeze({
  window: "var(--window-shadow)",
  card: "var(--card-shadow)",
  content: "var(--content-shadow)",
  elevated: "var(--elevated-shadow)",
});

export const typography = Object.freeze({
  title: {
    family: "var(--font-title-family)",
    size: "var(--font-title-size)",
    weight: "var(--font-title-weight)",
  },
  subtitle: {
    family: "var(--font-subtitle-family)",
    size: "var(--font-subtitle-size)",
    weight: "var(--font-subtitle-weight)",
  },
  ui: {
    family: "var(--font-ui-family)",
    size: "var(--font-ui-size)",
    weight: "var(--font-ui-weight)",
  },
  body: {
    family: "var(--font-body-family)",
    size: "var(--font-body-size)",
    weight: "var(--font-body-weight)",
  },
  navigation: {
    family: "var(--font-navigation-family)",
    size: "var(--font-navigation-size)",
    weight: "var(--font-navigation-weight)",
    transform: "var(--font-navigation-transform)",
  },
  data: {
    family: "var(--font-data-family)",
    size: "var(--font-data-size)",
    weight: "var(--font-data-weight)",
  },
  caption: {
    family: "var(--font-caption-family)",
    size: "var(--font-caption-size)",
    weight: "var(--font-caption-weight)",
    transform: "var(--font-caption-transform)",
    letterSpacing: "var(--font-caption-letter-spacing)",
  },
});

export const transitions = Object.freeze({
  fast: "var(--transition-speed)",
  slow: "var(--transition-speed-slow)",
  easing: "var(--transition-easing)",
});
