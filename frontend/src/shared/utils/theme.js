export const THEME_TOKENS = {
  light: {
    // ====== TUS TOKENS DE APP ======
    "--leftbar-width": "68px",
    "--leftbar-collapsed-width": "68px",
    "--rightpanel-width": "360px",

    "--background-color": "#C8CACD",
    "--modal-background": "#EAEAEA",
    "--window-background": "#EAEAEA",
    "--surface-color": "#FEFEFE",
    "--modal-surface": "#EEF1F6",
    "--surface-actions": "#F4F6FA",
    "--bubble-received": "#E7EDF3",
    "--sent-message": "#8A6EFF", // Unificado con accent-color

    // 🎭 Action Modals (Buy, Request, Send, etc.)
    "--action-modal-container-bg-base": "#F4F6FA",   // Base para el fondo del modal
    "--action-modal-overlay-bg": "rgba(10, 11, 14, 0.40)",  // Backdrop detrás del modal
    "--action-modal-width": "min(420px, 85vw)",      // Ancho del modal
    "--action-modal-max-height": "min(700px, 90vh)", // Altura máxima del modal
    "--action-modal-padding": "20px",                // Padding interno del modal
    "--action-modal-gap": "18px",                    // Gap entre secciones principales (header, card, botones)
    "--action-modal-surface": "#F7F8FB",             // Fondo para botones/inputs (más elevado)
    "--action-modal-surface-hover": "#EFF1F5",       // Fondo hover para botones/inputs
    
    // Botón primario de action cards (Request, Buy, Send, etc.)
    "--action-card-btn-padding": "8px 16px",
    "--action-card-btn-radius": "12px",
    "--action-card-btn-font-size": "0.85rem",
    "--action-card-btn-font-weight": "600",

    "--highlight-color": "#2A3442",
    "--border-color": "#C7C9CD",
    "--border-color-active": "#9B9DA0",

    "--text-on-window": "#1A1B1E", // Sólido (casi negro) - Máxima legibilidad: nombres, títulos principales
    "--text-on-surface": "#2D2E32", // Sólido (gris oscuro) - Legibilidad en cards/burbujas
    "--sent-text": "#FFFFFF", // Texto blanco en burbujas enviadas (sobre morado)
    "--text-primary": "rgba(0, 0, 0, 0.9)", // Opacidad - Títulos destacados, elementos importantes
    "--text-secondary": "rgba(0, 0, 0, 0.7)", // Opacidad - Botones, acciones, interactivo (mismo que DARK invertido)
    "--text-muted": "rgba(0, 0, 0, 0.55)", // Opacidad - Info, placeholders, disabled (mismo que DARK invertido)

    "--window-shadow": "0px 4px 12px rgba(0,0,0,0.08)",
    "--content-shadow": "inset 0px 2px 5px rgba(0,0,0,0.06)",
    "--card-shadow": "0 2px 8px rgba(0,0,0,0.06)",
    "--elevated-shadow": "0 8px 24px rgba(0,0,0,0.12)",
    
    // Transiciones y animaciones
    "--transition-speed": "0s",
    "--transition-speed-slow": "0s",
    "--transition-easing": "ease",
    "--transition-all": "none",
    
    // Border radius (modernos)
    "--radius-sm": "8px",
    "--radius-md": "12px",
    "--radius-lg": "16px",
    "--radius-xl": "20px",
    "--radius-full": "999px",
    
    // Spacing consistente
    "--space-xs": "4px",
    "--space-sm": "8px",
    "--space-md": "12px",
    "--space-lg": "16px",
    "--space-xl": "24px",
    "--space-2xl": "32px",
    
    // ===== SISTEMA DE COLORES SEMÁNTICOS =====
    
    // ACCIÓN (CTAs principales: enviar, confirmar, pagar)
    // Alternativas futuras: #FF6B35 (naranja coral), #FF4785 (rosa vibrante), #00D4AA (turquesa eléctrico)
    "--action-color": "#FC554F",
    "--action-color-hover": "#FF6B65",
    
    // ACENTO (elementos UI: tabs activos, badges, highlights)
    "--accent-color": "#8A6EFF", // Unificado dark/light para coherencia de marca
    "--accent-color-hover": "#9A7EFF",
    
    // ESTADOS
    "--surface-pure": "#FEFEFE",
    "--walletbutton-shadow": "#FA6560",
    "--background-overlay": "rgba(248,246,244,0.2)",
    "--hover-overlay": "rgba(138, 110, 255, 0.08)", // Unificado con morado #8A6EFF
    "--active-overlay": "rgba(138, 110, 255, 0.15)", // Unificado con morado #8A6EFF
    
    // Overlays oscuros
    "--overlay-dark-heavy": "rgba(0, 0, 0, 0.45)",
    "--overlay-dark-medium": "rgba(0, 0, 0, 0.28)",
    "--overlay-dark-light": "rgba(0, 0, 0, 0.08)",
    
    // Sistema de semáforo (notificaciones)
    "--success-color": "rgb(34, 197, 94)", // Verde unificado
    "--warning-color": "#fbbf24",
    "--error-color": "#ff8581",
    "--header-title-offset-collapsed": "0px",
    "--header-title-offset-expanded": "220px",

    "--transport-rtc-color": "var(--text-secondary)",
    "--transport-relay-color": "var(--border-color-active)",
    "--transport-rtc-color-sent": "var(--sent-text)",
    "--transport-relay-color-sent": "var(--sent-text)",

    // ====== WALLET ADAPTER ESPECÍFICOS ======
    "--focus-ring": "color-mix(in srgb, var(--action-color) 28%, transparent)",
    "--chip-border": "var(--border-color)",
    "--chip-bg": "transparent",
    "--chip-text": "var(--text-secondary)",
    "--font-ui-family": "'Montserrat', sans-serif",
    "--font-ui-size": "14px",
    "--font-ui-weight": "450",
    "--font-data-family": "'IBM Plex Mono', monospace",
    "--font-data-size": "13px",
    "--font-data-weight": "450",
    "--font-title-family": "'Montserrat', sans-serif",
    "--font-title-size": "1.25rem",
    "--font-title-weight": "700",
    "--font-subtitle-family": "'Montserrat', sans-serif",
    "--font-subtitle-size": "1rem",
    "--font-subtitle-weight": "600",
    "--font-body-family": "'Inter', sans-serif",
    "--font-body-size": "0.95rem",
    "--font-body-weight": "400",
    "--font-caption-family": "'Montserrat', sans-serif",
    "--font-caption-size": "0.78rem",
    "--font-caption-weight": "600",
    "--font-caption-transform": "uppercase",
    "--font-caption-letter-spacing": "0.08em",
    "--font-navigation-family": "'IBM Plex Sans', sans-serif",
    "--font-navigation-size": "14px",
    "--font-navigation-weight": "400",
    "--font-navigation-transform": "uppercase",
    "--wa-chip-opacity": "0.75",

    // ====== JUPITER PLUGIN (LIGHT) ======
    // Valores de la página de Jupiter (ya en R,G,B):
    "--jupiter-plugin-primary": "210, 199, 255",      // #D1C7FF
    "--jupiter-plugin-background": "245, 246, 248",   // #F5F6F8
    "--jupiter-plugin-primary-text": "42, 52, 66",    // #2A3442
    "--jupiter-plugin-warning": "251, 191, 36",       // amber 500
    "--jupiter-plugin-interactive": "195, 204, 217",  // #C3CCD9
    "--jupiter-plugin-module": "223, 226, 236",       // #DFE2EC
    // Compatibilidad (algunas builds usan camelCase):
    "--jupiter-plugin-primaryText": "42, 52, 66"
  },

  dark: {
    // ====== TUS TOKENS DE APP ======
    "--leftbar-width": "68px",
    "--leftbar-collapsed-width": "68px",
    "--rightpanel-width": "360px",

    "--background-color": "#171717",
    "--modal-background": "#171717",
    "--window-background": "#202124",
    "--surface-color": "#2C2D30",
    "--modal-surface": "#171A20",
    "--surface-actions": "#2C333C",
    "--bubble-received": "#2A2B30",
    "--sent-message": "#8A6EFF",

    // 🎭 Action Modals (Buy, Request, Send, etc.) - MISMO QUE BUY
    "--action-modal-container-bg-base": "#2C333C",   // Base oscuro para fondo del modal (mismo que surface-actions)
    "--action-modal-overlay-bg": "rgba(10, 11, 14, 0.40)",  // Backdrop detrás del modal
    "--action-modal-width": "min(420px, 85vw)",      // Ancho del modal
    "--action-modal-max-height": "min(700px, 90vh)", // Altura máxima del modal
    "--action-modal-padding": "20px",                // Padding interno del modal
    "--action-modal-gap": "18px",                    // Gap entre secciones principales (header, card, botones)
    "--action-modal-surface": "rgba(255, 255, 255, 0.08)",  // Fondo para botones/inputs (más visible)
    "--action-modal-surface-hover": "rgba(255, 255, 255, 0.12)",  // Fondo hover para botones/inputs
    
    // Botón primario de action cards (Request, Buy, Send, etc.)
    "--action-card-btn-padding": "8px 16px",
    "--action-card-btn-radius": "12px",
    "--action-card-btn-font-size": "0.85rem",
    "--action-card-btn-font-weight": "600",

    "--highlight-color": "#E0DED9",
    "--border-color": "rgba(255, 255, 255, 0.08)",
    "--border-color-active": "rgba(255, 255, 255, 0.15)",

    "--text-on-window": "#FAFAFA", // Sólido (98%) - Máxima legibilidad: nombres, títulos principales
    "--text-on-surface": "#E8E8E8", // Sólido (91%) - Legibilidad en cards/burbujas
    "--sent-text": "#FFFFFF", // Texto blanco en burbujas enviadas (sobre morado)
    "--text-primary": "rgba(255, 255, 255, 0.9)", // Opacidad - Títulos destacados, elementos importantes
    "--text-secondary": "rgba(255, 255, 255, 0.7)", // Opacidad - Botones, acciones, interactivo
    "--text-muted": "rgba(255, 255, 255, 0.55)", // Opacidad - Info, placeholders, disabled

    "--window-shadow": "0px 4px 16px rgba(0,0,0,0.35)",
    "--content-shadow": "inset 0px 2px 5px rgba(0,0,0,0.4)",
    "--card-shadow": "0 4px 16px rgba(0,0,0,0.25)",
    "--elevated-shadow": "0 12px 40px rgba(0,0,0,0.45)",
    
    // Transiciones y animaciones
    "--transition-speed": "0s",
    "--transition-speed-slow": "0s",
    "--transition-easing": "ease",
    "--transition-all": "none",
    
    // Border radius (modernos)
    "--radius-sm": "8px",
    "--radius-md": "12px",
    "--radius-lg": "16px",
    "--radius-xl": "20px",
    "--radius-full": "999px",
    
    // Spacing consistente
    "--space-xs": "4px",
    "--space-sm": "8px",
    "--space-md": "12px",
    "--space-lg": "16px",
    "--space-xl": "24px",
    "--space-2xl": "32px",
    
    // ===== SISTEMA DE COLORES SEMÁNTICOS =====
    
    // ACCIÓN (CTAs principales: enviar, confirmar, pagar)
    // Alternativas futuras: #FF6B35 (naranja coral), #FF4785 (rosa vibrante), #00D4AA (turquesa eléctrico)
    "--action-color": "#FC554F",
    "--action-color-hover": "#FF6B65",
    
    // ACENTO (elementos UI: tabs activos, badges, highlights)
    "--accent-color": "#8A6EFF",
    "--accent-color-hover": "#9A7EFF",
    
    // ESTADOS
    "--surface-pure": "#1F232B",
    "--walletbutton-shadow": "#E04A45",
    "--background-overlay": "rgba(38,36,36,0.2)",
    "--hover-overlay": "rgba(138, 110, 255, 0.1)",
    "--active-overlay": "rgba(138, 110, 255, 0.18)",
    
    // Overlays oscuros (mismo que light para consistencia)
    "--overlay-dark-heavy": "rgba(0, 0, 0, 0.45)",
    "--overlay-dark-medium": "rgba(0, 0, 0, 0.28)",
    "--overlay-dark-light": "rgba(0, 0, 0, 0.08)",
    
    // Sistema de semáforo (notificaciones)
    "--success-color": "rgb(34, 197, 94)", // Verde unificado
    "--warning-color": "#fbbf24",
    "--error-color": "#ff8581",
    "--header-title-offset-collapsed": "0px",
    "--header-title-offset-expanded": "220px",

    "--transport-rtc-color": "var(--text-secondary)",
    "--transport-relay-color": "var(--border-color-active)",
    "--transport-rtc-color-sent": "var(--sent-text)",
    "--transport-relay-color-sent": "var(--sent-text)",

    // ====== WALLET ADAPTER ESPECÍFICOS ======
    "--focus-ring": "color-mix(in srgb, var(--action-color) 28%, transparent)",
    "--chip-border": "var(--border-color)",
    "--chip-bg": "transparent",
    "--chip-text": "var(--text-secondary)",
    "--font-ui-family": "'Montserrat', sans-serif",
    "--font-ui-size": "14px",
    "--font-ui-weight": "450",
    "--font-data-family": "'IBM Plex Mono', monospace",
    "--font-data-size": "13px",
    "--font-data-weight": "450",
    "--font-title-family": "'Montserrat', sans-serif",
    "--font-title-size": "1.25rem",
    "--font-title-weight": "700",
    "--font-subtitle-family": "'Montserrat', sans-serif",
    "--font-subtitle-size": "1rem",
    "--font-subtitle-weight": "600",
    "--font-body-family": "'Inter', sans-serif",
    "--font-body-size": "0.95rem",
    "--font-body-weight": "400",
    "--font-caption-family": "'Montserrat', sans-serif",
    "--font-caption-size": "0.78rem",
    "--font-caption-weight": "600",
    "--font-caption-transform": "uppercase",
    "--font-caption-letter-spacing": "0.08em",
    "--font-navigation-family": "'IBM Plex Sans', sans-serif",
    "--font-navigation-size": "14px",
    "--font-navigation-weight": "400",
    "--font-navigation-transform": "uppercase",
    "--wa-chip-opacity": "0.75",

    // ====== JUPITER PLUGIN (DARK) ======
    // Convertido a R,G,B (sin comillas, sin rgb()):
    "--jupiter-plugin-primary": "176, 144, 252",      // #B090FC
    "--jupiter-plugin-background": "18, 20, 24",      // #121418
    "--jupiter-plugin-primary-text": "240, 240, 240", // #F0F0F0
    "--jupiter-plugin-warning": "251, 191, 36",       // amber 500
    "--jupiter-plugin-interactive": "36, 42, 54",     // #242A36
    "--jupiter-plugin-module": "26, 30, 38",          // #1A1E26
    // Compatibilidad camelCase:
    "--jupiter-plugin-primaryText": "240, 240, 240"
  }
};

// ================= core =================
export function applyTheme(theme) {
  const selected = THEME_TOKENS[theme] || THEME_TOKENS.light;

  // 1) aplica todos los tokens tal cual
  for (const [name, value] of Object.entries(selected)) {
    document.documentElement.style.setProperty(name, value);
  }

  // 2) marca el tema (por si estilos dependientes lo usan)
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";

  // 3) persistencia
  localStorage.setItem("theme", theme);
}

export function getPreferredTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function toggleTheme() {
  const current = document.documentElement.dataset.theme || getPreferredTheme();
  applyTheme(current === "light" ? "dark" : "light");
}

// Inicializa al cargar - COMENTADO para evitar doble aplicación
// applyTheme(getPreferredTheme());

Object.keys(THEME_TOKENS).forEach((key) => Object.freeze(THEME_TOKENS[key]));
Object.freeze(THEME_TOKENS);
