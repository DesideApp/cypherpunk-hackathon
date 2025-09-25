const THEMES = {
  light: {
    // ====== TUS TOKENS DE APP ======
    "--leftbar-width": "68px",
    "--leftbar-collapsed-width": "68px",
    "--rightpanel-width": "360px",

    "--background-color": "#FAFBFC",
    "--window-background": "#F5F6F8",
    "--surface-color": "#FFFFFF",
    "--bubble-received": "#E7EDF3",
    "--sent-message": "#B8A8FF",

    "--highlight-color": "#2A3442",
    "--border-color": "#D2D8E0",
    "--border-color-active": "#9B9DA0",

    "--text-primary": "#2A3442",
    "--text-secondary": "#4B5563",
    "--text-on-surface": "#1F2937",
    "--text-on-window": "#1E2734",

    "--window-shadow": "0px 4px 12px rgba(0,0,0,0.08)",
    "--content-shadow": "inset 0px 2px 5px rgba(0,0,0,0.06)",
    "--transition-speed": "0.3s",
    "--transition-easing": "ease",
    "--action-color": "#FC554F",
    "--walletbutton-shadow": "#FA6560",
    "--background-overlay": "rgba(248,246,244,0.2)",
    "--hover-overlay": "rgba(30,41,59,0.06)",
    "--active-overlay": "rgba(30,41,59,0.12)",
    "--header-title-offset-collapsed": "0px",
    "--header-title-offset-expanded": "220px",

    // ====== JUPITER PLUGIN (LIGHT) ======
    // Valores de la página de Jupiter (ya en R,G,B):
    "--jupiter-plugin-primary": "184, 168, 255",      // #B8A8FF (tu connect)
    "--jupiter-plugin-background": "250, 251, 252",   // #FAFBFC aprox
    "--jupiter-plugin-primary-text": "42, 52, 66",    // #2A3442 (tu text-primary)
    "--jupiter-plugin-warning": "251, 191, 36",       // amber 500
    "--jupiter-plugin-interactive": "228, 236, 245",  // #E4ECF5
    "--jupiter-plugin-module": "245, 246, 248",       // #F5F6F8
    // Compatibilidad (algunas builds usan camelCase):
    "--jupiter-plugin-primaryText": "42, 52, 66"
  },

  dark: {
    // ====== TUS TOKENS DE APP ======
    "--leftbar-width": "68px",
    "--leftbar-collapsed-width": "68px",
    "--rightpanel-width": "360px",

    "--background-color": "#1E1F22",
    "--window-background": "#16171A",
    "--surface-color": "#1F232B",
    "--bubble-received": "#28333B",
    "--sent-message": "#8A6EFF",

    "--highlight-color": "#E0DED9",
    "--border-color": "#2A2C31",
    "--border-color-active": "#4A4E55",

    "--text-primary": "#F5F5F5",
    "--text-secondary": "#B5B5B5",
    "--text-on-surface": "#E0E0E0",
    "--text-on-window": "#F8F8F8",

    "--window-shadow": "0px 4px 12px rgba(0,0,0,0.2)",
    "--content-shadow": "inset 0px 2px 5px rgba(0,0,0,0.26)",
    "--transition-speed": "0.3s",
    "--transition-easing": "ease",
    "--action-color": "#FC554F",
    "--walletbutton-shadow": "#E04A45",
    "--background-overlay": "rgba(38,36,36,0.2)",
    "--hover-overlay": "rgba(224,222,217,0.08)",
    "--active-overlay": "rgba(224,222,217,0.16)",
    "--header-title-offset-collapsed": "0px",
    "--header-title-offset-expanded": "220px",

    // ====== JUPITER PLUGIN (DARK) ======
    // Convertido a R,G,B (sin comillas, sin rgb()):
    "--jupiter-plugin-primary": "138, 110, 255",      // #8A6EFF
    "--jupiter-plugin-background": "22, 23, 26",      // #16171A
    "--jupiter-plugin-primary-text": "245, 245, 245", // #F5F5F5
    "--jupiter-plugin-warning": "251, 191, 36",       // amber 500
    "--jupiter-plugin-interactive": "31, 35, 43",     // #1F232B
    "--jupiter-plugin-module": "40, 51, 59",          // #28333B
    // Compatibilidad camelCase:
    "--jupiter-plugin-primaryText": "245, 245, 245"
  }
};

// ================= core =================
export function applyTheme(theme) {
  const selected = THEMES[theme] || THEMES.light;

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

// Inicializa al cargar
applyTheme(getPreferredTheme());
