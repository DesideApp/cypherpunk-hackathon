// theme/getCssVariable.ts
// Reads CSS variables from DOM with fallback values

export const getCssVariable = (
  varName: string,
  fallback: string = ''
): string => {
  if (typeof window === 'undefined') return fallback;

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();

  return value || fallback;
};
