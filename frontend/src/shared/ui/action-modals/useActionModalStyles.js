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
 */
export function useActionModalStyles(meta) {
  // Si meta es una Promise, no hacer nada (React debería esperar a que se resuelva)
  if (meta && typeof meta.then === 'function') {
    console.warn('[useActionModalStyles] Received Promise instead of resolved value!');
    return {
      cardStyle: undefined,
      logoStyle: undefined,
      logoInnerStyle: undefined,
      icon: DEFAULTS.icon,
    };
  }
  
  if (!meta) {
    return {
      cardStyle: undefined,
      logoStyle: undefined,
      logoInnerStyle: undefined,
      icon: DEFAULTS.icon,
    };
  }

  // Solo usar defaults si NO hay tint definido en el meta
  // Si meta tiene tint, debe venir de tokenMeta.js y usar SUS valores
  const hasTokenTint = meta.tint && typeof meta.tint === 'string';
  
  const tint = hasTokenTint ? meta.tint : DEFAULTS.tint;
  const glow = hasTokenTint && meta.glow ? meta.glow : DEFAULTS.glow;
  const background = hasTokenTint && meta.background ? meta.background : DEFAULTS.background;
  const iconScale =
    typeof meta.iconScale === "number" ? meta.iconScale : DEFAULTS.iconScale;

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
    icon: meta.icon || null,
  };
}

