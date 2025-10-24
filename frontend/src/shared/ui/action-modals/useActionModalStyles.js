import { useState, useEffect } from 'react';

const DEFAULTS = {
  tint: "rgba(59,130,246,0.7)",
  glow: "rgba(59,130,246,0.12)",
  background: "rgba(255,255,255,0.05)",
  iconScale: 0.86,
  icon: null,
};

/**
 * Map token metadata (tint, glow, background, icon) to CSS custom properties.
 * The styles are consumed by action modal components to keep parity with Buy.
 * Handles both Promise and resolved values.
 */
export function useActionModalStyles(meta) {
  const [resolvedMeta, setResolvedMeta] = useState(null);
  
  // Si meta es una Promise, esperar a que se resuelva
  useEffect(() => {
    if (!meta) {
      setResolvedMeta(null);
      return;
    }
    
    if (typeof meta.then === 'function') {
      // Es una Promise, esperar
      meta.then((resolved) => setResolvedMeta(resolved)).catch(() => setResolvedMeta(null));
    } else {
      // Ya es un objeto resuelto
      setResolvedMeta(meta);
    }
  }, [meta]);
  
  if (!resolvedMeta) {
    return {
      cardStyle: undefined,
      logoStyle: undefined,
      logoInnerStyle: undefined,
      icon: DEFAULTS.icon,
    };
  }

  // Solo usar defaults si NO hay tint definido en el meta
  // Si meta tiene tint, debe venir de tokenMeta.js y usar SUS valores
  const hasTokenTint = resolvedMeta.tint && typeof resolvedMeta.tint === 'string';
  
  const tint = hasTokenTint ? resolvedMeta.tint : DEFAULTS.tint;
  const glow = hasTokenTint && resolvedMeta.glow ? resolvedMeta.glow : DEFAULTS.glow;
  const background = hasTokenTint && resolvedMeta.background ? resolvedMeta.background : DEFAULTS.background;
  const iconScale =
    typeof resolvedMeta.iconScale === "number" ? resolvedMeta.iconScale : DEFAULTS.iconScale;

  return {
    cardStyle: {
      "--card-accent": tint,
      "--card-sheen": glow,
      "--card-bg": background,
    },
    logoStyle: {
      "--icon-outline": tint,
      "--icon-bg": background,
      "--icon-glow": glow,
    },
    logoInnerStyle: {
      "--icon-scale": iconScale,
    },
    icon: resolvedMeta.icon || null,
  };
}

