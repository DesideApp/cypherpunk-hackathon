export const tokens = {
  light: {
    // 🎨 Colores base
    '--background-color': '#FAFBFC',
    '--window-background': '#F5F6F8',
    '--text-primary': '#2A3442',
    '--text-on-window': '#1A1A1A',
    '--text-secondary': '#4B5563',         // ✅ Gris azulado intermedio
    '--text-on-surface': '#1F2937',        // ✅ Texto sobre surface
    '--surface-color': '#ffffff',          // ⚪️ Superficie clara (puedes ajustarla)

    // 🎭 Action Modals (Buy, Request, Send, etc.)
    '--action-modal-container-bg-base': '#F5F6F8',   // Color base del fondo del modal
    '--action-modal-overlay-bg': 'rgba(10, 11, 14, 0.40)',  // Backdrop oscuro detrás del modal
    
    // 🟠 Acción / Botón principal
    '--action-color': '#FC554F',
    '--walletbutton-shadow': '#FA6560',
    '--accent-color': '#3b82f6',           // Color de acento (línea superior modal)

    // 🔹 Hover y overlays
    '--hover-overlay': 'rgba(30, 41, 59, 0.08)',
    '--border-color': '#D2D8E0',
    '--border-color-active': '#9CA3AF',    // Borde activo/hover

    // � Focus y chips
    '--focus-ring': 'color-mix(in srgb, var(--action-color) 28%, transparent)',
    '--chip-border': 'var(--border-color)',
    '--chip-bg': 'transparent',
    '--chip-text': 'var(--text-secondary)',

    // �🅰️ Tipografía UI
    '--font-ui-family': `'Montserrat', sans-serif`,
    '--font-ui-size': '14px',
    '--font-ui-weight': '450',

    // 🔢 Tipografía datos (pubkey, balance, etc.)
    '--font-data-family': `'IBM Plex Mono', monospace`,
    '--font-data-size': '13px',
    '--font-data-weight': '450',

    // 🔠 Navegación / cajas info
    '--font-navigation-family': `'IBM Plex Sans', sans-serif`,
    '--font-navigation-size': '14px',
    '--font-navigation-weight': '400',
    '--font-navigation-transform': 'uppercase',

    // 🎯 Wallet Adapter específicos
    '--wa-chip-opacity': '0.75',
  },

  dark: {
    // 🎨 Colores base
    '--background-color': '#1E1F22',
    '--window-background': '#16171A',
    '--text-primary': '#F5F5F5',
    '--text-on-window': '#F8F8F8',
    '--text-secondary': '#B5B5B5',         // Gris claro como en theme.js
    '--text-on-surface': '#E0E0E0',        // Texto claro sobre surface oscuro
    '--surface-color': '#1f232bff',        // 🌑 Superficie oscura

    // 🎭 Action Modals (Buy, Request, Send, etc.) - MISMO QUE BUY
    '--action-modal-container-bg-base': '#16171A',   // Color base del fondo del modal (oscuro)
    '--action-modal-overlay-bg': 'rgba(10, 11, 14, 0.40)',  // Backdrop oscuro detrás del modal
    
    // 🟠 Acción / Botón principal
    '--action-color': '#FC554F',
    '--walletbutton-shadow': '#E04A45',
    '--accent-color': '#3b82f6',           // Color de acento (línea superior modal)

    // 🔹 Hover y overlays
    '--hover-overlay': 'rgba(224, 222, 217, 0.08)',
    '--border-color': '#2A2C31',
    '--border-color-active': '#3A3C41',    // Borde activo/hover

    // � Focus y chips
    '--focus-ring': 'color-mix(in srgb, var(--action-color) 28%, transparent)',
    '--chip-border': 'var(--border-color)',
    '--chip-bg': 'transparent',
    '--chip-text': 'var(--text-secondary)',

    // �🅰️ Tipografía UI
    '--font-ui-family': `'Montserrat', sans-serif`,
    '--font-ui-size': '14px',
    '--font-ui-weight': '450',

    // 🔢 Tipografía datos (pubkey, balance, etc.)
    '--font-data-family': `'IBM Plex Mono', monospace`,
    '--font-data-size': '13px',
    '--font-data-weight': '450',

    // 🔠 Navegación / cajas info
    '--font-navigation-family': `'IBM Plex Sans', sans-serif`,
    '--font-navigation-size': '14px',
    '--font-navigation-weight': '400',
    '--font-navigation-transform': 'uppercase',

    // 🎯 Wallet Adapter específicos
    '--wa-chip-opacity': '0.75',
  }
};
