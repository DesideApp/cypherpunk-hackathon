// theme/getCssVariable.ts

import { tokens } from './tokens';

type ThemeMode = keyof typeof tokens;
type CssVarName = keyof typeof tokens['light']; // ⬅️ Aquí tipamos explícitamente

export const getCssVariable = (
  varName: CssVarName,
  fallbackTheme: ThemeMode = 'light'
): string => {
  if (typeof window === 'undefined') return tokens[fallbackTheme][varName];

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();

  return value || tokens[fallbackTheme][varName];
};
