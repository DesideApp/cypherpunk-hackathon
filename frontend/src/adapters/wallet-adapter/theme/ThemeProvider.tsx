import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>('light');

  const injectWalletAdapterStyles = useCallback(() => {
    const styleId = 'wa-theme-styles';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      /* Wallet Adapter - Botones y inputs ghost */
      .wa-ghost-input,
      .wa-ghost-button {
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        box-shadow: none;
        outline: none;
      }
      
      .wa-ghost-button:active,
      .wa-ghost-input:active {
        transform: none;
        box-shadow: none !important;
      }
      
      .wa-ghost-button:focus-visible,
      .wa-ghost-input:focus-visible {
        outline: 0;
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--action-color) 28%, transparent);
      }
      
      /* Chips más sutiles */
      [data-wa-chip] { 
        opacity: var(--wa-chip-opacity); 
      }
    `;
  }, []);

  // Inyectar estilos al montar (theme.js maneja las variables CSS)
  useEffect(() => {
    injectWalletAdapterStyles();
  }, [injectWalletAdapterStyles]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    // Note: theme.js maneja la aplicación real de temas
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
