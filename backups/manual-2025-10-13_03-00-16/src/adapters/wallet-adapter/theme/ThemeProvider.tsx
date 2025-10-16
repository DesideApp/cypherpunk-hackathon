import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { tokens } from './tokens';

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

  const applyTheme = useCallback((mode: ThemeMode) => {
    const themeVars = tokens[mode];
    for (const key in themeVars) {
      document.documentElement.style.setProperty(key, themeVars[key]);
    }
    localStorage.setItem('theme', mode);

    // Inyectar estilos CSS específicos del wallet-adapter
    injectWalletAdapterStyles();
  }, [injectWalletAdapterStyles]);

  useEffect(() => {
    const preferred = localStorage.getItem('theme') as ThemeMode | null;
    const fallback = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    const active = preferred === 'light' || preferred === 'dark' ? preferred : fallback;
    setTheme(active);
    applyTheme(active);
  }, [applyTheme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
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
